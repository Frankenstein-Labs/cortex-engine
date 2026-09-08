import type { ModelCapabilities, ModelRef } from '@cortex/core';
import { OpenAICompatibleModelRuntime, type ModelMessage } from '@cortex/model-runtime';

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
    baseUrl: (options.baseUrl ?? process.env.QWEN3_OMNI_BASE_URL ?? DEFAULT_QWEN3_OMNI_BASE_URL).replace(/\/$/, ''),
    parameters: { backend: 'vllm', multimodal: true },
  };
}

export class Qwen3OmniClient {
  readonly modelRef: ModelRef;
  readonly runtime: OpenAICompatibleModelRuntime;

  constructor(options: Qwen3OmniClientOptions = {}) {
    this.modelRef = createQwen3OmniModelRef(options);
    this.runtime = new OpenAICompatibleModelRuntime({
      model: { ...this.modelRef, apiKey: options.apiKey ?? process.env.QWEN3_OMNI_API_KEY },
      capabilities: qwen3OmniCapabilities,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
    });
  }

  async healthCheck(): Promise<boolean> {
    return (await this.runtime.health()).healthy;
  }

  async complete(options: Qwen3OmniCompletionOptions): Promise<Qwen3OmniCompletionResult> {
    if (options.stream) throw new Error('Streaming requires completeStream(); use stream=false for complete()');
    const messages = options.messages as ModelMessage[];
    const result = await this.runtime.generate({
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      ...(options.useAudioInVideo === undefined ? {} : { use_audio_in_video: options.useAudioInVideo }),
    });
    return { ...result, raw: result.raw };
  }
}

export { Qwen3OmniAgent } from './qwen-agent';
