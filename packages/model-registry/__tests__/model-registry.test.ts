import { createDefaultModelRegistry, InMemoryModelRegistry } from '../src';

describe('model registry', () => {
  it('ships six officially sourced cards with explicit statuses', () => {
    const registry = createDefaultModelRegistry();
    expect(registry.listCards()).toHaveLength(6);
    expect(registry.getCard('qwen3-omni')).toMatchObject({ status: 'integrated', version: 'Qwen3-Omni-30B-A3B-Instruct' });
    expect(registry.getCard('kimi-k2')).toMatchObject({ status: 'candidate', version: 'Kimi-K2-Instruct' });
    expect(registry.getCard('kimi-k2.5')).toMatchObject({ status: 'candidate', version: 'Kimi-K2.5' });
    expect(registry.getCard('kimi-k3')).toMatchObject({ status: 'candidate', version: 'Kimi-K3' });
    expect(registry.getCard('glm-5.3')).toMatchObject({ status: 'candidate', version: 'GLM-5.3', model: { model: 'zai-org/GLM-5.3' } });
    expect(registry.getCard('deepseek-v4-pro')).toMatchObject({ status: 'candidate', version: 'DeepSeek-V4-Pro' });
  });

  it('keeps lifecycle states distinct from integration status', () => {
    const registry = createDefaultModelRegistry();
    expect(registry.getCard('qwen3-omni')?.lifecycle).toEqual(['DISCOVERED', 'AUDITED', 'CONFIGURED', 'RUNTIME-READY', 'INTEGRATED', 'VERIFIED']);
    expect(registry.getCard('kimi-k3')?.lifecycle).toEqual(['DISCOVERED', 'AUDITED']);
    expect(registry.listCards({ lifecycle: 'RUNTIME-READY' }).map((card) => card.model.id)).toEqual(['qwen3-omni']);
    expect(registry.listCards({ lifecycle: 'VERIFIED' }).map((card) => card.model.id)).toEqual(['qwen3-omni']);
  });

  it('routes only integrated models and filters by capability', () => {
    const registry = createDefaultModelRegistry();
    expect(registry.listRoutable().map((card) => card.model.id)).toEqual(['qwen3-omni']);
    expect(registry.listCards({ modality: 'tool-use' }).map((card) => card.model.id)).toEqual(['kimi-k2', 'kimi-k2.5', 'kimi-k3', 'glm-5.3', 'deepseek-v4-pro']);
    expect(registry.listCards({ supportsVision: true }).map((card) => card.model.id)).toEqual(['qwen3-omni', 'kimi-k2.5', 'kimi-k3']);
  });

  it('updates a registered model while preserving its audit card', () => {
    const registry = createDefaultModelRegistry();
    registry.register({ id: 'kimi-k2', provider: 'custom', model: 'moonshotai/Kimi-K2-Instruct', baseUrl: 'http://kimi:8000/v1' }, {
      supportsTools: true, supportsVision: false, supportsStreaming: true, maxContextTokens: 128000, maxOutputTokens: 8192,
    });
    expect(registry.getCard('kimi-k2')).toMatchObject({ status: 'candidate', model: { baseUrl: 'http://kimi:8000/v1' }, capabilities: { maxContextTokens: 128000 } });
  });

  it('creates an explicit discovered candidate for an unclassified registration', () => {
    const registry = new InMemoryModelRegistry();
    registry.register({ id: 'new-model', provider: 'custom', model: 'new/model' }, {
      supportsTools: false, supportsVision: false, supportsStreaming: false, maxContextTokens: 1, maxOutputTokens: 1,
    });
    expect(registry.getCard('new-model')).toMatchObject({ status: 'candidate', lifecycle: ['DISCOVERED'], license: { verification: 'unknown' } });
  });
});
