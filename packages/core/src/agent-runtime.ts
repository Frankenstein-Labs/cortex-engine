export interface AgentRuntimeBridge {
  readonly engine: 'kilo' | 'openhands';
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
  createSession(config: { title?: string; agent?: string; model?: string }): Promise<string>;
  sendPrompt(sessionId: string, prompt: string): Promise<unknown>;
  streamEvents(sessionId: string): AsyncIterable<Record<string, unknown>>;
  getSessionStatus(sessionId: string): Promise<Record<string, unknown>>;
  closeSession(sessionId: string): Promise<void>;
}
