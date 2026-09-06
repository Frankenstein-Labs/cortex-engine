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
  ToolContext,
  ToolResult,
  Runtime,
  EventBus,
  PermissionChecker,
} from '@cortex/core';

/**
 * OpenHandsAgentAdapter bridges an OpenHands agent into Cortex's Agent interface.
 *
 * OpenHands agents are:
 * - Python-based (in openhands-agent-server)
 * - Managed via HTTP API or subprocess
 * - Have conversation/session state
 * - Execute actions (commands, edits, browser, etc.)
 * - Produce observations (output, errors)
 */
export interface OpenHandsAgentAdapterOptions {
  /** OpenHands server URL */
  serverUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Conversation ID (if resuming existing) */
  conversationId?: string;
  /** Direct subprocess handle (for local execution) */
  subprocess?: unknown;
}

export class OpenHandsAgentAdapter implements Agent {
  readonly config: AgentConfig;
  readonly state: AgentState;
  private session: Session | null = null;
  private stopped = false;
  private options: OpenHandsAgentAdapterOptions;

  constructor(config: AgentConfig, options: OpenHandsAgentAdapterOptions) {
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
  }

  async start(): Promise<void> {
    this.state.status = 'idle';
    this.state.startedAt = new Date();
    this.state.lastActivityAt = new Date();

    if (this.options.subprocess) {
      // Local subprocess mode
      // TODO: Start/openhands-agent-server subprocess
    } else if (this.options.serverUrl) {
      // Remote API mode
      // TODO: Create conversation via HTTP API
      // POST /api/conversations
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.state.status = 'stopped';

    if (this.options.subprocess) {
      // TODO: Kill subprocess
    } else if (this.options.serverUrl) {
      // TODO: Close conversation via HTTP API
      // POST /api/conversations/{id}/stop
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
    const metrics = {
      tokensUsed: 0,
      toolCalls: 0,
      durationMs: 0,
      cost: 0,
    };

    try {
      const output = await this.runOpenHandsTask(task, metrics);
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

  protected async runOpenHandsTask(task: Task, metrics: { tokensUsed: number; toolCalls: number; durationMs: number; cost: number }): Promise<unknown> {
    // Placeholder implementation
    // Real implementation would:
    // 1. Send task to OpenHands conversation
    // 2. Stream events back (actions, observations)
    // 3. Handle browser/terminal/git actions
    // 4. Wait for completion
    // 5. Return final state

    console.log(`[OpenHandsAgentAdapter] Executing task: ${task.name}`);
    console.log(`[OpenHandsAgentAdapter] Server: ${this.options.serverUrl}`);

    return {
      task,
      server: this.options.serverUrl,
      message: 'OpenHands adapter placeholder - implement with real OpenHands API',
    };
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

    // TODO: Execute via OpenHands runtime
    // OpenHands actions include: run, run_in_background, kill, read,
    // write, edit, browse, browser_click_drag, etc.

    return {
      success: false,
      error: 'OpenHands tool execution not yet implemented',
    };
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
