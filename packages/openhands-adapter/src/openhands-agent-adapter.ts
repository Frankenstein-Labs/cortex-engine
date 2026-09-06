import { Agent, AgentConfig, AgentState, AgentMessage, AgentAction, AgentObservation, Session, Task, TaskResult, Tool, ToolContext, ToolResult, EventBus } from '@cortex/core';

export interface OpenHandsAdapterOptions {
  serverUrl: string;
  apiKey?: string;
}

export class OpenHandsAgentAdapter implements Agent {
  readonly config: AgentConfig;
  readonly state: AgentState;
  private session: Session | null = null;
  private stopped = false;
  private options: OpenHandsAdapterOptions;
  private conversationId?: string;

  constructor(config: AgentConfig, options: OpenHandsAdapterOptions) {
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
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.state.status = 'stopped';

    if (this.conversationId) {
      try {
        await this.post('/api/conversations/' + this.conversationId + '/stop');
      } catch {
        // ignore
      }
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
      const conversationId = await this.ensureConversation();
      this.conversationId = conversationId;

      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: task.description || task.name,
        timestamp: new Date(),
      };
      if (!this.session) {
        this.session = {
          id: crypto.randomUUID(),
          agentId: this.config.id,
          messages: [userMsg],
          actions: [],
          observations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        this.session.messages.push(userMsg);
      }

      const result = await this.sendMessageToConversation(conversationId, task.description || task.name, metrics);

      if (result.assistantMessage) {
        this.session.messages.push(result.assistantMessage);
      }

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

  private async ensureConversation(): Promise<string> {
    const data = await this.post('/api/conversations', {
      title: this.config.name,
      agent: this.config.role,
    }) as { conversation_id?: string; id?: string };
    return data.conversation_id || data.id || '';
  }

  private async sendMessageToConversation(conversationId: string, message: string, metrics: { tokensUsed: number; toolCalls: number; cost: number }): Promise<{ assistantMessage?: AgentMessage; events?: unknown[] }> {
    const data = await this.post('/api/conversations/' + encodeURIComponent(conversationId) + '/messages', {
      message,
      sources: [],
    }) as { response?: unknown; usage?: { total_tokens?: number; totalTokens?: number; cost?: number }; events?: unknown[] };

    metrics.tokensUsed += (data.usage?.total_tokens || data.usage?.totalTokens || 0) as number;
    metrics.cost += (data.usage?.cost || 0) as number;

    const assistantMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: typeof data.response === 'string' ? data.response : JSON.stringify(data.response),
      timestamp: new Date(),
    };

    return { assistantMessage, events: data.events };
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
      const data = await this.post('/api/conversations/' + encodeURIComponent(this.conversationId) + '/actions', {
        type: toolName,
        parameters,
      });

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

  private async post(path: string, body?: unknown): Promise<unknown> {
    const url = new URL(path, this.options.serverUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.options.apiKey) {
      headers['Authorization'] = `Bearer ${this.options.apiKey}`;
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenHands API error: ${res.status} ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return data;
  }
}
