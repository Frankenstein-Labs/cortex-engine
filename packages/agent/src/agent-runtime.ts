import {
  Agent,
  AgentConfig,
  AgentState,
  AgentMessage,
  AgentAction,
  AgentObservation,
  Session,
  Task,
  TaskResult,
  Tool,
  ToolResult,
  EventBus,
  PermissionChecker,
  RuntimeRef,
  WorkspaceRef,
  AgentBudget,
  ModelRef,
} from '@cortex/core';

export class BaseAgent implements Agent {
  readonly config: AgentConfig;
  readonly state: AgentState;
  private session: Session | null = null;
  private stopped = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      status: 'idle',
      iterationCount: 0,
      tokensUsed: 0,
      toolCallsUsed: 0,
      cost: 0,
      lastActivityAt: new Date(),
    };
  }

  async start(): Promise<void> {
    this.state.status = 'idle';
    this.state.startedAt = new Date();
    this.state.lastActivityAt = new Date();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.state.status = 'stopped';
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
    const metrics = {
      tokensUsed: 0,
      toolCalls: 0,
      durationMs: 0,
      cost: 0,
    };

    try {
      const output = await this.runTaskLoop(task, metrics);
      this.state.status = 'idle';
      this.state.currentTaskId = undefined;
      return {
        success: true,
        output,
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

  protected async runTaskLoop(task: Task, metrics: { tokensUsed: number; toolCalls: number; durationMs: number; cost: number }): Promise<unknown> {
    throw new Error('runTaskLoop must be implemented by subclass');
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
    throw new Error('callTool must be implemented by subclass');
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
