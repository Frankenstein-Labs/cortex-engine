import type { ModelCapabilities, ModelRef } from '@cortex/core';

export const QWEN3_OMNI_MODEL = 'Qwen/Qwen3-Omni-30B-A3B-Instruct';
export const DEFAULT_QWEN3_OMNI_BASE_URL = 'http://127.0.0.1:8000/v1';

export type Qwen3OmniContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } }
  | { type: 'video_url'; video_url: { url: string } };

export interface Qwen3OmniMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Qwen3OmniContentPart[];
}

export interface Qwen3OmniClientOptions {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface Qwen3OmniCompletionOptions {
  messages: Qwen3OmniMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  useAudioInVideo?: boolean;
}

export interface Qwen3OmniCompletionResult {
  id?: string;
  output: string;
  finishReason?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  raw: unknown;
}

export const qwen3OmniCapabilities: ModelCapabilities = {
  supportsTools: false,
  supportsVision: true,
  supportsStreaming: true,
  maxContextTokens: 32768,
  maxOutputTokens: 8192,
};

export function createQwen3OmniModelRef(options: Qwen3OmniClientOptions = {}): ModelRef {
  return {
    id: options.model ?? QWEN3_OMNI_MODEL,
    provider: 'custom',
    model: options.model ?? QWEN3_OMNI_MODEL,
    baseUrl: normalizeBaseUrl(options.baseUrl ?? process.env.QWEN3_OMNI_BASE_URL ?? DEFAULT_QWEN3_OMNI_BASE_URL),
    parameters: { backend: 'vllm', multimodal: true },
  };
}

export class Qwen3OmniClient {
  readonly modelRef: ModelRef;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;

  constructor(options: Qwen3OmniClientOptions = {}) {
    this.modelRef = createQwen3OmniModelRef(options);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.apiKey = options.apiKey ?? process.env.QWEN3_OMNI_API_KEY;
    if (!this.fetchImpl) throw new Error('Fetch is unavailable; use Node.js 18+ or provide fetch in options');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/models', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(options: Qwen3OmniCompletionOptions): Promise<Qwen3OmniCompletionResult> {
    const response = await this.request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: this.modelRef.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024,
        stream: options.stream ?? false,
        ...(options.useAudioInVideo === undefined ? {} : { use_audio_in_video: options.useAudioInVideo }),
      }),
    });
    const data = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(`Qwen3-Omni request failed (${response.status}): ${JSON.stringify(data).slice(0, 500)}`);
    if (options.stream) throw new Error('Streaming requires completeStream(); use stream=false for complete()');
    const content = data.choices?.[0]?.message?.content;
    return {
      id: data.id,
      output: typeof content === 'string' ? content : extractText(content),
      finishReason: data.choices?.[0]?.finish_reason,
      usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } : undefined,
      raw: data,
    };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = new Headers(init.headers);
      headers.set('content-type', 'application/json');
      if (this.apiKey) headers.set('authorization', `Bearer ${this.apiKey}`);
      return await this.fetchImpl(`${this.modelRef.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return content == null ? '' : String(content);
  return content.map((part) => typeof part === 'string' ? part : part?.text ?? '').join('');
}

export { Qwen3OmniAgent } from './qwen-agent';
