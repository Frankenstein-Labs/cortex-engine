import { Qwen3OmniClient, createQwen3OmniModelRef } from '../src';

describe('Qwen3OmniClient', () => {
  it('creates a multimodal model reference with a configurable endpoint', () => {
    expect(createQwen3OmniModelRef({ baseUrl: 'http://qwen:8000/v1/' })).toMatchObject({
      provider: 'custom',
      model: 'Qwen/Qwen3-Omni-30B-A3B-Instruct',
      baseUrl: 'http://qwen:8000/v1',
      parameters: { backend: 'vllm', multimodal: true },
    });
  });

  it('checks health and sends text plus multimodal content to the OpenAI-compatible endpoint', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      return new Response(JSON.stringify({
        id: 'chatcmpl-qwen',
        choices: [{ message: { content: 'Qwen response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      }), { status: 200 });
    };
    const client = new Qwen3OmniClient({ baseUrl: 'http://qwen:8000/v1', apiKey: 'test-key', fetch: fetchMock });

    await expect(client.healthCheck()).resolves.toBe(true);
    const result = await client.complete({
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe this image.' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
      ] }],
      maxTokens: 80,
    });

    expect(result.output).toBe('Qwen response');
    expect(result.usage?.totalTokens).toBe(16);
    expect(calls[1].url).toBe('http://qwen:8000/v1/chat/completions');
    expect((calls[1].init?.headers as Headers).get('authorization')).toBe('Bearer test-key');
    expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({
      model: 'Qwen/Qwen3-Omni-30B-A3B-Instruct',
      max_tokens: 80,
      stream: false,
    });
  });

  it('surfaces provider errors', async () => {
    const client = new Qwen3OmniClient({
      fetch: async () => new Response(JSON.stringify({ error: { message: 'model unavailable' } }), { status: 503 }),
    });
    await expect(client.complete({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toThrow('503');
  });
});
