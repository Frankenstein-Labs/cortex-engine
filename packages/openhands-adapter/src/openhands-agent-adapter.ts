import { Agent, AgentConfig, AgentState, AgentMessage, AgentAction, AgentObservation, Session, Task, TaskResult, Tool, ToolContext, ToolResult } from '@cortex/core';
import { OpenHandsRuntimeBridge } from './openhands-runtime-bridge';

export interface OpenHandsAdapterOptions {
  serverUrl?: string;
  apiKey?: string;
  workingDir?: string;
}

export class OpenHandsAgentAdapter implements Agent {
  readonly config: AgentConfig;
  readonly state: AgentState;
  private session: Session | null = null;
  private stopped = false;
  private options: OpenHandsAdapterOptions;
  private conversationId?: string;
  private bridge: OpenHandsRuntimeBridge;

  constructor(config: AgentConfig, options: OpenHandsAdapterOptions = {}) {
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
    this.bridge = new OpenHandsRuntimeBridge({
      serverUrl: options.serverUrl,
      apiKey: options.apiKey,
      workingDir: options.workingDir,
    });
  }

  async start(): Promise<void> {
    await this.bridge.start();
    this.state.status = 'idle';
    this.state.startedAt = new Date();
    this.state.lastActivityAt = new Date();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.state.status = 'stopped';
    if (this.conversationId) {
      try {
        await this.bridge.closeSession(this.conversationId);
      } catch {
        // ignore
      }
    }
    await this.bridge.stop();
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
      if (!this.conversationId) {
        this.conversationId = await this.bridge.createSession({
          title: task.name,
          agent: this.config.role,
          model: this.config.model?.model || 'default',
        });
      }

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

      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: task.description || task.name,
        timestamp: new Date(),
      };
      this.session.messages.push(userMsg);

      const result = await this.bridge.sendPrompt(this.conversationId, task.description || task.name);
      const resultData = result as { usage?: { totalTokens?: number; cost?: number }; events?: unknown[] };

      metrics.tokensUsed += resultData.usage?.totalTokens || 0;
      metrics.cost += resultData.usage?.cost || 0;

      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: JSON.stringify(result),
        timestamp: new Date(),
      };
      this.session.messages.push(assistantMsg);

      this.state.status = 'idle';
      this.state.currentTaskId = undefined;
      return {
        success: true,
        output: result,
        metrics,
      };
    } catch (err) {
      this.state.status = 'error';
      this.state.error = err instanceof Error ? err.message : String(err);
      this.state.currentTaskId = undefined;
      return {
        success: false,
        error: this.state.error,
        metrics,
      };
    } finally {
      metrics.durationMs = Date.now() - startTime;
    }
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

    if (!this.conversationId) {
      return { success: false, error: 'No active conversation' };
    }

    try {
      const data = await this.bridge.executeTool(this.conversationId, toolName, parameters);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getSession(): Promise<Session> {
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
