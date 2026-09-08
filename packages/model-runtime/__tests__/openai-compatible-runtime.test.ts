import { OpenAICompatibleModelRuntime } from '../src';

describe('OpenAICompatibleModelRuntime', () => {
  const model = { id: 'test-model', provider: 'custom' as const, model: 'test/model', baseUrl: 'http://model:8000/v1' };

  it('maps generate options and exposes health state', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      return new Response(JSON.stringify({ id: 'completion-1', choices: [{ message: { content: 'done' }, finish_reason: 'stop' }], usage: { total_tokens: 3 } }), { status: 200 });
    };
    const runtime = new OpenAICompatibleModelRuntime({ model, fetch: fetchMock });
    await expect(runtime.load()).resolves.toBeUndefined();
    const result = await runtime.generate({ messages: [{ role: 'user', content: 'hello' }], maxTokens: 42 });
    expect(result.output).toBe('done');
    expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({ model: 'test/model', max_tokens: 42, stream: false });
    await runtime.unload();
  });

  it('parses server-sent streaming chunks', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"id":"s1","choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    });
    const runtime = new OpenAICompatibleModelRuntime({ model, fetch: async () => new Response(body, { status: 200 }) });
    const chunks = [];
    for await (const chunk of runtime.stream({ messages: [{ role: 'user', content: 'hello' }] })) chunks.push(chunk);
    expect(chunks.map((chunk) => chunk.delta).join('')).toBe('Hi!');
    expect(chunks.at(-1)?.finishReason).toBe('stop');
  });
});
