import { AgentRuntimeBridge } from '@cortex/core';
import { ProcessManager } from '@cortex/runtime';

export interface OpenHandsRuntimeBridgeOptions {
  serverUrl?: string;
  apiKey?: string;
  workingDir?: string;
  signal?: AbortSignal;
}

export class OpenHandsRuntimeBridge implements AgentRuntimeBridge {
  readonly engine = 'openhands' as const;
  private manager: unknown = null;
  private conversations: Map<string, unknown> = new Map();
  private processManager: ProcessManager;
  private options: OpenHandsRuntimeBridgeOptions;
  private started = false;
  private sdkPromise: Promise<{
    ConversationManager: new (options: { host: string; apiKey?: string }) => {
      createConversation: (agent: unknown, options?: { workingDir?: string }) => Promise<{ id: string }>;
      loadConversation: (id: string, workingDir?: string) => Promise<unknown>;
      getConversation: (id: string) => Promise<unknown>;
      deleteConversation: (id: string) => Promise<void>;
      getConversations: (ids: string[]) => Promise<unknown[]>;
      close: () => void;
    };
    RemoteConversation: new (agent: unknown, workspace: unknown, options?: unknown) => {
      id: string;
      sendMessage: (message: string) => Promise<void>;
      run: () => Promise<void>;
      close: () => Promise<void>;
    };
    WebSocketCallbackClient: new (options: { host: string; conversationId: string; callback: (event: unknown) => void; apiKey?: string }) => {
      start: () => void;
      stop: () => void;
    };
  }> | null = null;

  constructor(options: OpenHandsRuntimeBridgeOptions = {}) {
    this.options = options;
    this.processManager = new ProcessManager();
  }

  private async loadSdk(): Promise<{
    ConversationManager: new (options: { host: string; apiKey?: string }) => {
      createConversation: (agent: unknown, options?: { workingDir?: string }) => Promise<{ id: string }>;
      loadConversation: (id: string, workingDir?: string) => Promise<unknown>;
      getConversation: (id: string) => Promise<unknown>;
      deleteConversation: (id: string) => Promise<void>;
      getConversations: (ids: string[]) => Promise<unknown[]>;
      close: () => void;
    };
    RemoteConversation: new (agent: unknown, workspace: unknown, options?: unknown) => {
      id: string;
      sendMessage: (message: string) => Promise<void>;
      run: () => Promise<void>;
      close: () => Promise<void>;
    };
    WebSocketCallbackClient: new (options: { host: string; conversationId: string; callback: (event: unknown) => void; apiKey?: string }) => {
      start: () => void;
      stop: () => void;
    };
  }> {
    if (!this.sdkPromise) {
      this.sdkPromise = import('@openhands/typescript-client').then((mod) => ({
        ConversationManager: mod.ConversationManager as new (options: { host: string; apiKey?: string }) => {
          createConversation: (agent: unknown, options?: { workingDir?: string }) => Promise<{ id: string }>;
          loadConversation: (id: string, workingDir?: string) => Promise<unknown>;
          getConversation: (id: string) => Promise<unknown>;
          deleteConversation: (id: string) => Promise<void>;
          getConversations: (ids: string[]) => Promise<unknown[]>;
          close: () => void;
        },
        RemoteConversation: mod.RemoteConversation as new (agent: unknown, workspace: unknown, options?: unknown) => {
          id: string;
          sendMessage: (message: string) => Promise<void>;
          run: () => Promise<void>;
          close: () => Promise<void>;
        },
        WebSocketCallbackClient: mod.WebSocketCallbackClient as new (options: { host: string; conversationId: string; callback: (event: unknown) => void; apiKey?: string }) => {
          start: () => void;
          stop: () => void;
        },
      }));
    }
    return this.sdkPromise;
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

    try {
      const sdk = await this.loadSdk();
      this.manager = new sdk.ConversationManager({
        host,
        apiKey: this.options.apiKey,
      });
    } catch (err) {
      console.warn(`OpenHands SDK not loaded: ${err instanceof Error ? err.message : String(err)}. Bridge will operate in limited mode.`);
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    for (const [, conv] of this.conversations) {
      try {
        await (conv as { close: () => Promise<void> }).close();
      } catch {
        // ignore
      }
    }
    this.conversations.clear();
    (this.manager as { close: () => void } | null)?.close();
    this.manager = null;
    this.processManager.killAll();
  }

  async healthCheck(): Promise<boolean> {
    if (!this.manager) return false;
    try {
      const mgr = this.manager as { getConversations: (ids: string[]) => Promise<unknown[]> };
      await mgr.getConversations([]);
      return true;
    } catch {
      return false;
    }
  }

  async createSession(config: { title?: string; agent?: string; model?: string }): Promise<string> {
    if (!this.manager) throw new Error('OpenHands runtime not started');
    const sdk = await this.loadSdk();

    const llm: Record<string, unknown> = { model: config.model || 'default' };
    if (config.model && config.model.includes('/')) {
      const [provider, model] = config.model.split('/');
      llm.model = model;
      llm.base_url = `https://openrouter.ai/api/v1`;
      llm.api_key = process.env.OPENROUTER_API_KEY;
    }

    const agentBase: Record<string, unknown> = {
      kind: config.agent ?? 'default',
      llm,
      name: config.title,
    };

    const mgr = this.manager as { createConversation: (agent: unknown, options?: { workingDir?: string }) => Promise<{ id: string }> };
    const conversation = await mgr.createConversation(agentBase, {
      workingDir: this.options.workingDir,
    });

    const conversationId = conversation.id;
    this.conversations.set(conversationId, conversation);
    return conversationId;
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<unknown> {
    const sdk = await this.loadSdk();
    let conversation = this.conversations.get(sessionId) as { sendMessage: (message: string) => Promise<void>; run: () => Promise<void> } | undefined;
    if (!conversation) {
      if (!this.manager) throw new Error('OpenHands runtime not started');
      const mgr = this.manager as { loadConversation: (id: string, workingDir?: string) => Promise<unknown> };
      conversation = await mgr.loadConversation(sessionId, this.options.workingDir) as { sendMessage: (message: string) => Promise<void>; run: () => Promise<void> };
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

    const callback = (event: unknown) => {
      queue.push(event as Record<string, unknown>);
      if (pending.resolve) {
        const r = pending.resolve;
        pending.resolve = undefined;
        r();
      }
    };

    const host = this.options.serverUrl ?? 'http://127.0.0.1:3000';
    const wsUrl = host.replace(/^http/, 'ws') + `/ws/conversations/${encodeURIComponent(sessionId)}`;

    const sdk = await this.loadSdk();
    const client = new sdk.WebSocketCallbackClient({
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
    const mgr = this.manager as { getConversation: (id: string) => Promise<unknown> };
    const conversation = await mgr.getConversation(sessionId);
    return conversation as unknown as Record<string, unknown>;
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.manager) throw new Error('OpenHands runtime not started');
    const mgr = this.manager as { deleteConversation: (id: string) => Promise<void> };
    await mgr.deleteConversation(sessionId);
    this.conversations.delete(sessionId);
  }
}
