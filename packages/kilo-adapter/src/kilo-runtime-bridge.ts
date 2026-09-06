import { AgentRuntimeBridge } from '@cortex/core';
import { ProcessManager } from '@cortex/runtime';

export interface KiloRuntimeBridgeOptions {
  hostname?: string;
  port?: number;
  config?: Record<string, unknown>;
  signal?: AbortSignal;
}

export class KiloRuntimeBridge implements AgentRuntimeBridge {
  readonly engine = 'kilo' as const;
  private client: unknown = null;
  private serverUrl: string | null = null;
  private processManager: ProcessManager;
  private options: KiloRuntimeBridgeOptions;
  private started = false;
  private sdkPromise: Promise<{ createKiloClient: (config: { baseUrl: string }) => unknown }> | null = null;

  constructor(options: KiloRuntimeBridgeOptions = {}) {
    this.options = {
      hostname: options.hostname ?? '127.0.0.1',
      port: options.port ?? 4096,
      config: options.config,
      signal: options.signal,
    };
    this.processManager = new ProcessManager();
  }

  private async loadSdk(): Promise<{ createKiloClient: (config: { baseUrl: string }) => unknown }> {
    if (!this.sdkPromise) {
      try {
        const mod = await import('@kilocode/sdk');
        this.sdkPromise = Promise.resolve({
          createKiloClient: mod.createKiloClient as (config: { baseUrl: string }) => unknown,
        });
      } catch (err) {
        const sdkPath = require('path').join(__dirname, '..', 'node_modules', '@kilocode/sdk', 'dist', 'index.js');
        const mod = await import(sdkPath);
        this.sdkPromise = Promise.resolve({
          createKiloClient: mod.createKiloClient as (config: { baseUrl: string }) => unknown,
        });
      }
    }
    return this.sdkPromise;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const managed = this.processManager.spawn('kilo-server', 'kilo', ['serve', `--hostname=${this.options.hostname}`, `--port=${this.options.port}`], {
      port: this.options.port,
      timeout: 15000,
    });

    try {
      await managed.start();
    } catch (err) {
      this.processManager.kill('kilo-server');
      throw new Error(`Failed to start Kilo server: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.serverUrl = `http://${this.options.hostname}:${this.options.port}`;
    const sdk = await this.loadSdk();
    this.client = sdk.createKiloClient({ baseUrl: this.serverUrl });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.processManager.killAll();
    this.client = null;
    this.serverUrl = null;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const session = (this.client as { session: { status: () => Promise<unknown> } }).session;
      await session.status();
      return true;
    } catch {
      return false;
    }
  }

  async createSession(config: { title?: string; agent?: string; model?: string }): Promise<string> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const session = (this.client as { session: { create: (params: { body: { title?: string; agent?: string } }) => { data: { id: string } } } }).session;
    const result = await session.create({
      body: {
        title: config.title,
        agent: config.agent,
      },
    });
    if (!result.data) {
      throw new Error('Failed to create Kilo session');
    }
    return result.data.id;
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<unknown> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const session = (this.client as { session: { prompt: (params: { path: { sessionID: string }; body: { parts: Array<{ type: string; text: string }> } }) => { data: unknown } } }).session;
    const result = await session.prompt({
      path: { sessionID: sessionId },
      body: {
        parts: [{ type: 'text', text: prompt }],
      },
    });
    return result.data;
  }

  async executeTool(sessionId: string, toolName: string, parameters: Record<string, unknown>): Promise<unknown> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const session = (this.client as { session: { command: (params: unknown) => Promise<{ data?: unknown }> } }).session;
    const result = await session.command({
      path: { id: sessionId },
      body: { command: toolName, arguments: JSON.stringify(parameters) },
    });
    return result.data;
  }

  async *streamEvents(sessionId: string): AsyncIterable<Record<string, unknown>> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const event = (this.client as { event: { subscribe: () => Promise<{ stream: AsyncIterable<unknown> }> } }).event;
    const result = await event.subscribe();
    for await (const evt of result.stream) {
      yield evt as Record<string, unknown>;
    }
  }

  async getSessionStatus(sessionId: string): Promise<Record<string, unknown>> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const session = (this.client as { session: { get: (params: { path: { sessionID: string } }) => { data: unknown } } }).session;
    const result = await session.get({
      path: { sessionID: sessionId },
    });
    return result.data as unknown as Record<string, unknown>;
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const session = (this.client as { session: { delete: (params: { path: { sessionID: string } }) => Promise<void> } }).session;
    await session.delete({
      path: { sessionID: sessionId },
    });
  }
}
