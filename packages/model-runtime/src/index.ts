import type { ModelCapabilities, ModelRef } from '@cortex/core';

export type ModelMessageContent = string | Array<Record<string, unknown>>;

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: ModelMessageContent;
  name?: string;
  toolCallId?: string;
}

export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface GenerateOptions {
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  [key: string]: unknown;
}

export interface GenerateResult {
  id?: string;
  output: string;
  finishReason?: string;
  usage?: ModelUsage;
  raw: Record<string, unknown>;
}

export interface StreamChunk {
  id?: string;
  delta: string;
  finishReason?: string;
  raw: Record<string, unknown>;
}

export interface ModelHealth {
  healthy: boolean;
  status: number;
  model?: string;
  error?: string;
}

export interface ModelRuntime {
  readonly model: ModelRef;
  readonly capabilities: ModelCapabilities;
  load(): Promise<void>;
  unload(): Promise<void>;
  health(): Promise<ModelHealth>;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

export interface OpenAICompatibleRuntimeOptions {
  model: ModelRef;
  capabilities?: Partial<ModelCapabilities>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  apiKey?: string;
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsTools: true,
  supportsVision: false,
  supportsStreaming: true,
  maxContextTokens: 32768,
  maxOutputTokens: 4096,
};

export class OpenAICompatibleModelRuntime implements ModelRuntime {
  readonly model: ModelRef;
  readonly capabilities: ModelCapabilities;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;
  private loaded = false;

  constructor(options: OpenAICompatibleRuntimeOptions) {
    this.model = { ...options.model, baseUrl: normalizeBaseUrl(options.model.baseUrl ?? 'http://localhost:8000/v1') };
    this.capabilities = { ...DEFAULT_CAPABILITIES, ...(options.capabilities ?? {}) };
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.apiKey = options.apiKey ?? options.model.apiKey;
    if (!this.fetchImpl) throw new Error('Fetch is unavailable; use Node.js 18+ or provide fetch in options');
  }

  async load(): Promise<void> {
    const result = await this.health();
    if (!result.healthy) throw new Error(result.error ?? `Model runtime is unhealthy (${result.status})`);
    this.loaded = true;
  }

  async unload(): Promise<void> {
    this.loaded = false;
  }

  async health(): Promise<ModelHealth> {
    try {
      const response = await this.request('/models', { method: 'GET' });
      const data = await response.json() as Record<string, unknown>;
      return { healthy: response.ok, status: response.status, model: this.model.model, error: response.ok ? undefined : JSON.stringify(data) };
    } catch (error) {
      return { healthy: false, status: 0, model: this.model.model, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const { messages, temperature, maxTokens, signal: _signal, ...providerOptions } = options;
    const data = await this.requestJson('/chat/completions', {
      messages,
      temperature: temperature ?? 0.2,
      max_tokens: maxTokens ?? 1024,
      ...providerOptions,
      stream: false,
    });
    const choice = (data.choices as Array<Record<string, unknown>> | undefined)?.[0] ?? {};
    const message = choice.message as Record<string, unknown> | undefined;
    return {
      id: typeof data.id === 'string' ? data.id : undefined,
      output: extractText(message?.content),
      finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : undefined,
      usage: normalizeUsage(data.usage),
      raw: data,
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const { messages, temperature, maxTokens, signal, ...providerOptions } = options;
    const response = await this.request('/chat/completions', {
      method: 'POST',
      signal,
      body: JSON.stringify({ model: this.model.model, messages, temperature: temperature ?? 0.2, max_tokens: maxTokens ?? 1024, ...providerOptions, stream: true }),
    });
    if (!response.body) throw new Error('Model provider returned no streaming body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '').trim();
          if (!payload || payload === '[DONE]') continue;
          const data = JSON.parse(payload) as Record<string, unknown>;
          const choice = (data.choices as Array<Record<string, unknown>> | undefined)?.[0] ?? {};
          const delta = choice.delta as Record<string, unknown> | undefined;
          yield { id: typeof data.id === 'string' ? data.id : undefined, delta: extractText(delta?.content), finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : undefined, raw: data };
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async requestJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.request(path, { method: 'POST', body: JSON.stringify({ model: this.model.model, temperature: 0.2, max_tokens: 1024, ...body }) });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(`Model request failed (${response.status}): ${JSON.stringify(data).slice(0, 500)}`);
    return data;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = new Headers(init.headers);
      headers.set('content-type', 'application/json');
      if (this.apiKey) headers.set('authorization', `Bearer ${this.apiKey}`);
      const response = await this.fetchImpl(`${this.model.baseUrl}${path}`, { ...init, headers, signal: init.signal ?? controller.signal });
      if (!response.ok && path === '/models') return response;
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeBaseUrl(value: string): string { return value.replace(/\/$/, ''); }
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : String(content);
  return content.map((part) => typeof part === 'string' ? part : (part as Record<string, unknown>)?.text ?? '').join('');
}
function normalizeUsage(usage: unknown): ModelUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const value = usage as Record<string, unknown>;
  return { promptTokens: value.prompt_tokens as number | undefined, completionTokens: value.completion_tokens as number | undefined, totalTokens: value.total_tokens as number | undefined };
}
