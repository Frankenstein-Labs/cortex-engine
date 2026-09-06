import { AgentRuntimeBridge } from '@cortex/core';
import { createKiloServer, createKiloClient } from '@kilocode/sdk';
import { ProcessManager } from '@cortex/runtime';

export interface KiloRuntimeBridgeOptions {
  hostname?: string;
  port?: number;
  config?: Record<string, unknown>;
  signal?: AbortSignal;
}

export class KiloRuntimeBridge implements AgentRuntimeBridge {
  readonly engine = 'kilo' as const;
  private client: ReturnType<typeof createKiloClient> | null = null;
  private serverUrl: string | null = null;
  private processManager: ProcessManager;
  private options: KiloRuntimeBridgeOptions;
  private started = false;

  constructor(options: KiloRuntimeBridgeOptions = {}) {
    this.options = {
      hostname: options.hostname ?? '127.0.0.1',
      port: options.port ?? 4096,
      config: options.config,
      signal: options.signal,
    };
    this.processManager = new ProcessManager();
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
    this.client = createKiloClient({ baseUrl: this.serverUrl });
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
      await this.client.session.status();
      return true;
    } catch {
      return false;
    }
  }

  async createSession(config: { title?: string; agent?: string; model?: string }): Promise<string> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const result = await this.client.session.create({
      body: {
        title: config.title,
      },
    });
    if (!result.data) {
      throw new Error('Failed to create Kilo session');
    }
    return result.data.id;
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<unknown> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: prompt }],
      },
    });
    return result.data;
  }

  async *streamEvents(sessionId: string): AsyncIterable<Record<string, unknown>> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const result = await this.client.event.subscribe();
    for await (const event of result.stream) {
      yield event as Record<string, unknown>;
    }
  }

  async getSessionStatus(sessionId: string): Promise<Record<string, unknown>> {
    if (!this.client) throw new Error('Kilo runtime not started');
    const result = await this.client.session.get({
      path: { id: sessionId },
    });
    return result.data as unknown as Record<string, unknown>;
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.client) throw new Error('Kilo runtime not started');
    await this.client.session.delete({
      path: { id: sessionId },
    });
  }
}
