import { Agent, AgentConfig, AgentState, AgentMessage, AgentAction, AgentObservation, Session, Task, TaskResult, Tool, ToolContext, ToolResult, EventBus } from '@cortex/core';
import { KiloRuntimeBridge } from './kilo-runtime-bridge';

export interface KiloAdapterOptions {
  serverUrl?: string;
  apiKey?: string;
  defaultAgentId?: string;
  config?: Record<string, unknown>;
}

export class KiloAgentAdapter implements Agent {
  readonly config: AgentConfig;
  readonly state: AgentState;
  private session: Session | null = null;
  private stopped = false;
  private options: KiloAdapterOptions;
  private eventBus: EventBus | null = null;
  private bridge: KiloRuntimeBridge;
  private currentKiloSessionId?: string;

  constructor(config: AgentConfig, options: KiloAdapterOptions = {}) {
    this.config = config;
    this.options = options;
    this.state = {
      status: 'idle',
      iterationCount: 0,
      tokensUsed: 0,
      toolCallsUsed: 0,
      cost: 0,
      lastActivityAt: new Date(),
    };
    this.bridge = new KiloRuntimeBridge({
      hostname: options.serverUrl ? undefined : undefined,
      port: options.serverUrl ? undefined : 4096,
      config: options.config,
    });
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  async start(): Promise<void> {
    await this.bridge.start();
    this.state.status = 'idle';
    this.state.startedAt = new Date();
    this.state.lastActivityAt = new Date();

    if (this.eventBus) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'agent.started',
        timestamp: new Date(),
        source: this.config.id,
        data: { agentId: this.config.id, name: this.config.name },
      });
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.state.status = 'stopped';
    await this.bridge.stop();

    if (this.eventBus) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'agent.stopped',
        timestamp: new Date(),
        source: this.config.id,
        data: { agentId: this.config.id },
      });
    }
  }

  async pause(): Promise<void> {
    this.state.status = 'waiting';
  }

  async resume(): Promise<void> {
    this.state.status = 'idle';
  }

  async execute(task: Task): Promise<TaskResult> {
    if (this.stopped) {
      throw new Error('Agent is stopped');
    }

    this.state.status = 'working';
    this.state.currentTaskId = task.id;
    this.state.lastActivityAt = new Date();

    const startTime = Date.now();
    const metrics = { tokensUsed: 0, toolCalls: 0, durationMs: 0, cost: 0 };

    try {
      const session = await this.ensureSession();

      if (this.eventBus) {
        this.eventBus.emit({
          id: crypto.randomUUID(),
          type: 'task.started',
          timestamp: new Date(),
          source: this.config.id,
          data: { taskId: task.id, taskName: task.name },
        });
      }

      this.currentKiloSessionId = await this.bridge.createSession({
        title: task.name,
        agent: this.options.defaultAgentId || 'build',
        model: this.config.model?.model || 'default',
      });

      const result = await this.bridge.sendPrompt(this.currentKiloSessionId, task.description || task.name);
      const resultData = result as { usage?: { totalTokens?: number; cost?: number }; message?: unknown; toolCalls?: unknown[] };
      metrics.tokensUsed += resultData.usage?.totalTokens || 0;
      metrics.cost += resultData.usage?.cost || 0;

      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: task.description || task.name,
        timestamp: new Date(),
      };
      session.messages.push(userMsg);

      if (resultData.message) {
        const assistantMsg: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: typeof resultData.message === 'string' ? resultData.message : JSON.stringify(resultData.message),
          timestamp: new Date(),
        };
        session.messages.push(assistantMsg);
      }

      this.state.toolCallsUsed += resultData.toolCalls?.length || 0;

      if (this.eventBus) {
        this.eventBus.emit({
          id: crypto.randomUUID(),
          type: 'task.completed',
          timestamp: new Date(),
          source: this.config.id,
          data: { taskId: task.id, success: true },
        });
      }

      this.state.status = 'idle';
      this.state.currentTaskId = undefined;
      return { success: true, output: result, metrics };
    } catch (err) {
      this.state.status = 'error';
      this.state.error = err instanceof Error ? err.message : String(err);
      this.state.currentTaskId = undefined;

      if (this.eventBus) {
        this.eventBus.emit({
          id: crypto.randomUUID(),
          type: 'task.failed',
          timestamp: new Date(),
          source: this.config.id,
          data: { taskId: task.id, error: this.state.error },
        });
      }

      return { success: false, error: this.state.error, metrics };
    } finally {
      metrics.durationMs = Date.now() - startTime;
    }
  }

  private async ensureSession(): Promise<Session> {
    if (!this.session) {
      this.session = {
        id: crypto.randomUUID(),
        agentId: this.config.id,
        messages: [],
        actions: [],
        observations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return this.session;
  }

  async sendMessage(message: string): Promise<AgentMessage> {
    const msg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    if (this.session) {
      this.session.messages.push(msg);
    }
    this.state.lastActivityAt = new Date();
    return msg;
  }

  async callTool(toolName: string, parameters: Record<string, unknown>): Promise<ToolResult> {
    this.state.toolCallsUsed += 1;
    this.state.lastActivityAt = new Date();
    if (!this.currentKiloSessionId) return { success: false, error: 'No active Kilo session' };
    try {
      const data = await this.bridge.executeTool(this.currentKiloSessionId, toolName, parameters);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getSession(): Promise<Session> {
    return this.ensureSession();
  }

  recordAction(action: AgentAction): void {
    if (this.session) {
      this.session.actions.push(action);
    }
  }

  recordObservation(observation: AgentObservation): void {
    if (this.session) {
      this.session.observations.push(observation);
    }
  }

  incrementIteration(): void {
    this.state.iterationCount += 1;
  }
}
