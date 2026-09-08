import { Qwen3OmniAgent } from '../src/qwen-agent';
import type { AgentConfig, Task } from '@cortex/core';
import { Qwen3OmniClient } from '../src';

const config: AgentConfig = {
  id: 'agent-qwen-test', name: 'Qwen test', role: 'developer', engine: 'qwen3-omni',
  model: { id: 'qwen', provider: 'custom', model: 'Qwen/Qwen3-Omni-30B-A3B-Instruct' },
  permissions: { id: 'policy', name: 'test', permissions: [], defaultEffect: 'allow' }, tools: [],
  runtime: { id: 'runtime', type: 'host', capabilities: [] }, workspace: { id: 'workspace', rootPath: '.' },
  budget: { maxTokens: 1000, maxToolCalls: 0, maxDurationMs: 10000 }, timeoutMs: 10000, maxIterations: 1,
};

const task = { id: 'task-qwen-test', name: 'Answer', description: 'Say hello', status: 'pending', priority: 'high', dependencies: [], budget: { maxTokens: 1000, maxToolCalls: 0, maxDurationMs: 10000 }, timeoutMs: 10000, retryCount: 0, maxRetries: 0, createdAt: new Date(), updatedAt: new Date() } as Task;

test('executes a Cortex task through Qwen3-Omni', async () => {
  const client = new Qwen3OmniClient({ fetch: async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Hello from Qwen' } }], usage: { total_tokens: 7 } }), { status: 200 }) });
  const agent = new Qwen3OmniAgent(config, client);
  const result = await agent.execute(task);
  expect(result.success).toBe(true);
  expect(result.output).toMatchObject({ output: 'Hello from Qwen', model: 'Qwen/Qwen3-Omni-30B-A3B-Instruct' });
  expect(result.metrics.tokensUsed).toBe(7);
});
