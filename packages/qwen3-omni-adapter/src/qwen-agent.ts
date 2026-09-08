import type { AgentConfig, Task } from '@cortex/core';
import { AgentRuntime } from '@cortex/agent';
import { Qwen3OmniClient, type Qwen3OmniMessage } from './index';

export class Qwen3OmniAgent extends AgentRuntime {
  private readonly client: Qwen3OmniClient;

  constructor(config: AgentConfig, client = new Qwen3OmniClient()) {
    super(config);
    this.client = client;
  }

  async runTaskLoop(task: Task, metrics: { tokensUsed: number; toolCalls: number; durationMs: number; cost: number }): Promise<unknown> {
    const system = typeof this.config.metadata?.systemPrompt === 'string'
      ? this.config.metadata.systemPrompt
      : 'You are the primary intelligence of Cortex Engine. Complete the requested task precisely and explain the result.';
    const messages: Qwen3OmniMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: task.description },
    ];
    const result = await this.client.complete({
      messages,
      maxTokens: Math.min(task.budget.maxTokens, 8192),
      temperature: 0.2,
    });
    metrics.tokensUsed = result.usage?.totalTokens ?? 0;
    return { output: result.output, model: this.client.modelRef.model, usage: result.usage };
  }

  async callTool(): Promise<never> {
    throw new Error('Qwen3-Omni agent does not execute tools directly; use a tool-enabled Cortex agent for workspace mutations.');
  }
}
