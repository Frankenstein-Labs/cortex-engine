import { AgentRuntimeBridge } from '@cortex/core';
import { ConversationManager, RemoteConversation, AgentBase, LLMConfig, WebSocketCallbackClient, ConversationCallbackType } from '@openhands/typescript-client';
import { ProcessManager } from '@cortex/runtime';

export interface OpenHandsRuntimeBridgeOptions {
  serverUrl?: string;
  apiKey?: string;
  workingDir?: string;
  signal?: AbortSignal;
}

export class OpenHandsRuntimeBridge implements AgentRuntimeBridge {
  readonly engine = 'openhands' as const;
  private manager: ConversationManager | null = null;
  private conversations: Map<string, RemoteConversation> = new Map();
  private processManager: ProcessManager;
  private options: OpenHandsRuntimeBridgeOptions;
  private started = false;

  constructor(options: OpenHandsRuntimeBridgeOptions = {}) {
    this.options = options;
    this.processManager = new ProcessManager();
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const host = this.options.serverUrl ?? 'http://127.0.0.1:3000';

    if (!this.options.serverUrl) {
      try {
        const managed = this.processManager.spawn('openhands-server', 'openhands-agent-server', ['--host', '127.0.0.1', '--port', '3000'], {
          port: 3000,
          timeout: 15000,
        });
        await managed.start();
      } catch (err) {
        console.warn(`OpenHands server not started: ${err instanceof Error ? err.message : String(err)}. Ensure openhands-agent-server is installed.`);
      }
    }

    this.manager = new ConversationManager({
      host,
      apiKey: this.options.apiKey,
    });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    for (const [, conv] of this.conversations) {
      try {
        await conv.close();
      } catch {
        // ignore
      }
    }
    this.conversations.clear();
    this.manager?.close();
    this.manager = null;
    this.processManager.killAll();
  }

  async healthCheck(): Promise<boolean> {
    if (!this.manager) return false;
    try {
      await this.manager.getConversations([]);
      return true;
    } catch {
      return false;
    }
  }

  async createSession(config: { title?: string; agent?: string; model?: string }): Promise<string> {
    if (!this.manager) throw new Error('OpenHands runtime not started');

    const llm: LLMConfig = { model: config.model || 'default' };
    if (config.model && config.model.includes('/')) {
      const [provider, model] = config.model.split('/');
      llm.model = model;
      llm.base_url = `https://openrouter.ai/api/v1`;
      llm.api_key = process.env.OPENROUTER_API_KEY;
    }

    const agentBase: AgentBase = {
      kind: config.agent ?? 'default',
      llm,
      name: config.title,
    };

    const conversation = await this.manager.createConversation(agentBase, {
      workingDir: this.options.workingDir,
    });

    const conversationId = conversation.id;
    this.conversations.set(conversationId, conversation);
    return conversationId;
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<unknown> {
    let conversation = this.conversations.get(sessionId);
    if (!conversation) {
      if (!this.manager) throw new Error('OpenHands runtime not started');
      conversation = await this.manager.loadConversation(sessionId, this.options.workingDir);
      this.conversations.set(sessionId, conversation);
    }
    await conversation.sendMessage(prompt);
    await conversation.run();
    return { conversationId: sessionId, status: 'completed' };
  }

  async *streamEvents(sessionId: string): AsyncIterable<Record<string, unknown>> {
    const queue: Record<string, unknown>[] = [];
    const pending: { resolve?: () => void } = {};
    let stopped = false;

    const callback: ConversationCallbackType = (event) => {
      queue.push(event as unknown as Record<string, unknown>);
      if (pending.resolve) {
        const r = pending.resolve;
        pending.resolve = undefined;
        r();
      }
    };

    const host = this.options.serverUrl ?? 'http://127.0.0.1:3000';
    const wsUrl = host.replace(/^http/, 'ws') + `/ws/conversations/${encodeURIComponent(sessionId)}`;

    const client = new WebSocketCallbackClient({
      host: wsUrl,
      conversationId: sessionId,
      callback,
      apiKey: this.options.apiKey,
    });

    client.start();

    try {
      while (!stopped) {
        while (queue.length > 0) {
          yield queue.shift()!;
        }
        await new Promise<void>((r) => { pending.resolve = r; });
      }
    } finally {
      stopped = true;
      if (pending.resolve) {
        pending.resolve();
      }
      client.stop();
    }
  }

  async getSessionStatus(sessionId: string): Promise<Record<string, unknown>> {
    if (!this.manager) throw new Error('OpenHands runtime not started');
    const conversation = await this.manager.getConversation(sessionId);
    return conversation as unknown as Record<string, unknown>;
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.manager) throw new Error('OpenHands runtime not started');
    await this.manager.deleteConversation(sessionId);
    this.conversations.delete(sessionId);
  }
}
