import type { ModelCapabilities, ModelRef, ModelRegistry } from '@cortex/core';

export type ModelIntegrationStatus = 'integrated' | 'candidate' | 'historical' | 'rejected';
export type LicenseVerificationStatus = 'verified' | 'requires-verification' | 'unknown';
export type ModelLifecycleState = 'DISCOVERED' | 'AUDITED' | 'CONFIGURED' | 'RUNTIME-READY' | 'INTEGRATED' | 'VERIFIED';

export interface ModelSource {
  label: string;
  url: string;
}

export interface ModelRuntimeMetadata {
  protocol: 'openai-compatible' | 'transformers' | 'sglang' | 'unknown';
  runtimes: string[];
  weights: string;
  hardwareNotes: string;
}

export interface ModelAuditCard {
  model: ModelRef;
  displayName: string;
  version: string;
  capabilities: ModelCapabilities;
  status: ModelIntegrationStatus;
  lifecycle: ModelLifecycleState[];
  modalities: Array<'text' | 'image' | 'audio' | 'video' | 'tool-use' | 'coding'>;
  license: {
    name?: string;
    verification: LicenseVerificationStatus;
    notes: string;
  };
  runtime: ModelRuntimeMetadata;
  sources: ModelSource[];
  auditNotes: string;
}

export interface ModelQuery {
  status?: ModelIntegrationStatus;
  lifecycle?: ModelLifecycleState;
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  modality?: ModelAuditCard['modalities'][number];
}

export class InMemoryModelRegistry implements ModelRegistry {
  private readonly cards = new Map<string, ModelAuditCard>();

  constructor(cards: ModelAuditCard[] = []) {
    for (const card of cards) this.registerCard(card);
  }

  register(model: ModelRef, capabilities: ModelCapabilities): void {
    const existing = this.cards.get(model.id);
    this.cards.set(model.id, existing
      ? { ...existing, model: { ...existing.model, ...model }, capabilities: { ...capabilities } }
      : createUnclassifiedCard(model, capabilities));
  }

  registerCard(card: ModelAuditCard): void {
    this.cards.set(card.model.id, cloneCard(card));
  }

  get(modelId: string): { model: ModelRef; capabilities: ModelCapabilities } | undefined {
    const card = this.cards.get(modelId);
    return card ? { model: { ...card.model }, capabilities: { ...card.capabilities } } : undefined;
  }

  getCard(modelId: string): ModelAuditCard | undefined {
    const card = this.cards.get(modelId);
    return card ? cloneCard(card) : undefined;
  }

  list(): Array<{ model: ModelRef; capabilities: ModelCapabilities }> {
    return [...this.cards.values()].map(({ model, capabilities }) => ({ model: { ...model }, capabilities: { ...capabilities } }));
  }

  listCards(query: ModelQuery = {}): ModelAuditCard[] {
    return [...this.cards.values()]
      .filter((card) => query.status === undefined || card.status === query.status)
      .filter((card) => query.lifecycle === undefined || card.lifecycle.includes(query.lifecycle))
      .filter((card) => query.supportsTools === undefined || card.capabilities.supportsTools === query.supportsTools)
      .filter((card) => query.supportsVision === undefined || card.capabilities.supportsVision === query.supportsVision)
      .filter((card) => query.supportsStreaming === undefined || card.capabilities.supportsStreaming === query.supportsStreaming)
      .filter((card) => query.modality === undefined || card.modalities.includes(query.modality))
      .map(cloneCard);
  }

  listRoutable(query: Omit<ModelQuery, 'status'> = {}): ModelAuditCard[] {
    return this.listCards({ ...query, status: 'integrated' });
  }
}

export const auditedModelCards: readonly ModelAuditCard[] = [
  {
    displayName: 'Qwen3-Omni-30B-A3B-Instruct', version: 'Qwen3-Omni-30B-A3B-Instruct',
    model: { id: 'qwen3-omni', provider: 'custom', model: 'Qwen/Qwen3-Omni-30B-A3B-Instruct', parameters: { backend: 'vllm', multimodal: true } },
    capabilities: { supportsTools: false, supportsVision: true, supportsStreaming: true, maxContextTokens: 32768, maxOutputTokens: 8192 },
    status: 'integrated', lifecycle: ['DISCOVERED', 'AUDITED', 'CONFIGURED', 'RUNTIME-READY', 'INTEGRATED', 'VERIFIED'],
    modalities: ['text', 'image', 'audio', 'video'],
    license: { name: 'Apache-2.0', verification: 'verified', notes: 'Licence du dépôt officiel et des composants publiés à vérifier séparément pour chaque poids distribué.' },
    runtime: { protocol: 'openai-compatible', runtimes: ['vLLM', 'Transformers'], weights: 'Qwen/Qwen3-Omni-30B-A3B-Instruct', hardwareNotes: 'Runtime Qwen/vLLM et poids téléchargés séparément sur une machine GPU.' },
    sources: [
      { label: 'Dépôt officiel Qwen3-Omni', url: 'https://github.com/QwenLM/Qwen3-Omni' },
      { label: 'Modèle officiel Hugging Face', url: 'https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct' },
      { label: 'Licence du dépôt', url: 'https://github.com/QwenLM/Qwen3-Omni/blob/main/LICENSE' },
    ],
    auditNotes: 'Seul modèle de cette liste intégré et testé dans Cortex via @cortex/qwen3-omni-adapter et un endpoint vLLM OpenAI-compatible. La vérification GPU de production reste externe au monorepo.',
  },
  {
    displayName: 'Kimi K2', version: 'Kimi-K2-Instruct',
    model: { id: 'kimi-k2', provider: 'custom', model: 'moonshotai/Kimi-K2-Instruct', parameters: { repository: 'MoonshotAI/Kimi-K2', toolCalls: true } },
    capabilities: { supportsTools: true, supportsVision: false, supportsStreaming: true, maxContextTokens: 128000, maxOutputTokens: 8192 },
    status: 'candidate', lifecycle: ['DISCOVERED', 'AUDITED'], modalities: ['text', 'coding', 'tool-use'],
    license: { name: 'Modified MIT License', verification: 'verified', notes: 'Licence publiée pour le code et les poids dans le dépôt officiel ; les conditions doivent encore être acceptées pour l’usage Cortex.' },
    runtime: { protocol: 'openai-compatible', runtimes: ['vLLM', 'SGLang', 'KTransformers', 'TensorRT-LLM'], weights: 'moonshotai/Kimi-K2-Instruct', hardwareNotes: 'Aucun profil matériel ni test d’inférence Cortex validé.' },
    sources: [
      { label: 'Dépôt officiel Kimi K2', url: 'https://github.com/moonshotai/kimi-k2' },
      { label: 'Modèle officiel Kimi-K2-Instruct', url: 'https://huggingface.co/moonshotai/Kimi-K2-Instruct' },
      { label: 'Licence officielle', url: 'https://github.com/moonshotai/kimi-k2/blob/main/LICENSE' },
    ],
    auditNotes: 'Le dépôt documente les tool calls et les moteurs de déploiement, mais Cortex ne l’exécute pas encore.',
  },
  {
    displayName: 'Kimi K2.5', version: 'Kimi-K2.5',
    model: { id: 'kimi-k2.5', provider: 'custom', model: 'moonshotai/Kimi-K2.5', parameters: { repository: 'MoonshotAI/Kimi-K2.5', multimodal: true } },
    capabilities: { supportsTools: true, supportsVision: true, supportsStreaming: true, maxContextTokens: 256000, maxOutputTokens: 8192 },
    status: 'candidate', lifecycle: ['DISCOVERED', 'AUDITED'], modalities: ['text', 'image', 'video', 'coding', 'tool-use'],
    license: { name: 'Modified MIT License', verification: 'verified', notes: 'Le dépôt indique que le code et les poids sont publiés sous Modified MIT License.' },
    runtime: { protocol: 'openai-compatible', runtimes: ['vLLM', 'SGLang', 'KTransformers', 'Transformers >= 4.57.1'], weights: 'moonshotai/Kimi-K2.5', hardwareNotes: 'Le coût et le profil GPU doivent être mesurés dans Cortex ; vidéo par API officielle uniquement selon le dépôt.' },
    sources: [
      { label: 'Dépôt officiel Kimi K2.5', url: 'https://github.com/MoonshotAI/Kimi-K2.5' },
      { label: 'Modèle officiel Kimi-K2.5', url: 'https://huggingface.co/moonshotai/Kimi-K2.5' },
      { label: 'Guide de déploiement officiel', url: 'https://github.com/MoonshotAI/Kimi-K2.5/blob/master/docs/deploy_guidance.md' },
      { label: 'Licence officielle', url: 'https://github.com/MoonshotAI/Kimi-K2.5/blob/master/LICENSE' },
    ],
    auditNotes: 'Modèle multimodal agentique officiellement documenté, mais aucune inférence Cortex n’est encore validée.',
  },
  {
    displayName: 'Kimi K3', version: 'Kimi-K3',
    model: { id: 'kimi-k3', provider: 'custom', model: 'moonshotai/Kimi-K3', parameters: { repository: 'MoonshotAI/Kimi-K3', multimodal: true } },
    capabilities: { supportsTools: true, supportsVision: true, supportsStreaming: true, maxContextTokens: 1048576, maxOutputTokens: 8192 },
    status: 'candidate', lifecycle: ['DISCOVERED', 'AUDITED'], modalities: ['text', 'image', 'video', 'coding', 'tool-use'],
    license: { name: 'Kimi K3 License', verification: 'verified', notes: 'Licence officielle distincte, appliquée au code et aux poids selon le dépôt Kimi K3.' },
    runtime: { protocol: 'openai-compatible', runtimes: ['vLLM', 'SGLang', 'TokenSpeed'], weights: 'moonshotai/Kimi-K3', hardwareNotes: 'Modèle 2.8T / 104B activés ; profil GPU et test d’inférence Cortex non réalisés.' },
    sources: [
      { label: 'Dépôt officiel Kimi K3', url: 'https://github.com/MoonshotAI/Kimi-K3' },
      { label: 'Modèle officiel Kimi-K3', url: 'https://huggingface.co/moonshotai/Kimi-K3' },
      { label: 'API et guide officiel', url: 'https://platform.kimi.ai/docs/guide/kimi-k3-quickstart' },
      { label: 'Licence officielle', url: 'https://github.com/MoonshotAI/Kimi-K3/blob/main/LICENSE' },
    ],
    auditNotes: 'Modèle open-weight multimodal agentique avec API OpenAI-compatible, mais non configuré ni exécuté dans Cortex.',
  },
  {
    displayName: 'GLM-5.3', version: 'GLM-5.3',
    model: { id: 'glm-5.3', provider: 'custom', model: 'zai-org/GLM-5.3', parameters: { repository: 'zai-org/GLM-5', agenticCoding: true } },
    capabilities: { supportsTools: true, supportsVision: false, supportsStreaming: true, maxContextTokens: 0, maxOutputTokens: 0 },
    status: 'candidate', lifecycle: ['DISCOVERED', 'AUDITED'], modalities: ['text', 'coding', 'tool-use'],
    license: { name: 'glm-5.3 (model); Apache-2.0 (repository)', verification: 'requires-verification', notes: 'La fiche officielle porte la licence modèle `glm-5.3`; le dépôt GitHub est Apache-2.0. Les conditions du poids doivent être validées avant intégration.' },
    runtime: { protocol: 'openai-compatible', runtimes: ['vLLM', 'SGLang', 'Transformers', 'KTransformers'], weights: 'zai-org/GLM-5.3 (FP8 ou BF16)', hardwareNotes: '744B-A40B ; aucun profil GPU ni test d’inférence Cortex validé.' },
    sources: [
      { label: 'Dépôt officiel GLM-5 / GLM-5.3', url: 'https://github.com/zai-org/GLM-5' },
      { label: 'Fiche modèle officielle GLM-5.3', url: 'https://huggingface.co/zai-org/GLM-5.3' },
      { label: 'Documentation officielle GLM-5.3', url: 'https://docs.z.ai/guides/llm/glm-5.3' },
      { label: 'Licence du dépôt', url: 'https://github.com/zai-org/GLM-5/blob/main/LICENSE' },
    ],
    auditNotes: 'GLM-5.3 est explicitement publié dans le dépôt officiel et sur la fiche Z.ai/Hugging Face. Il remplace toute référence GLM non versionnée ou historique.',
  },
  {
    displayName: 'DeepSeek-V4-Pro', version: 'DeepSeek-V4-Pro',
    model: { id: 'deepseek-v4-pro', provider: 'custom', model: 'deepseek-ai/DeepSeek-V4-Pro', parameters: { repository: 'deepseek-ai/DeepSeek-V4-Pro', contextLength: 1000000 } },
    capabilities: { supportsTools: true, supportsVision: false, supportsStreaming: true, maxContextTokens: 1000000, maxOutputTokens: 8192 },
    status: 'candidate', lifecycle: ['DISCOVERED', 'AUDITED'], modalities: ['text', 'coding', 'tool-use'],
    license: { name: 'MIT', verification: 'verified', notes: 'La fiche officielle DeepSeek-V4-Pro indique la licence MIT.' },
    runtime: { protocol: 'openai-compatible', runtimes: ['Transformers', 'vLLM', 'SGLang'], weights: 'deepseek-ai/DeepSeek-V4-Pro', hardwareNotes: '1.6T total / 49B activés ; exigences GPU lourdes et test Cortex non réalisés.' },
    sources: [
      { label: 'Fiche modèle officielle DeepSeek-V4-Pro', url: 'https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro' },
      { label: 'Site officiel DeepSeek', url: 'https://www.deepseek.com/' },
      { label: 'Rapport technique officiel', url: 'https://arxiv.org/abs/2606.19348' },
    ],
    auditNotes: 'Sixième modèle sélectionné après vérification d’une publication officielle, d’une licence et de procédures vLLM/SGLang. Il reste candidat non intégré.',
  },
];

export function createDefaultModelRegistry(): InMemoryModelRegistry {
  return new InMemoryModelRegistry([...auditedModelCards]);
}

function createUnclassifiedCard(model: ModelRef, capabilities: ModelCapabilities): ModelAuditCard {
  return {
    displayName: model.model, version: 'UNVERIFIED', model: { ...model }, capabilities: { ...capabilities }, status: 'candidate', lifecycle: ['DISCOVERED'], modalities: ['text'],
    license: { verification: 'unknown', notes: 'Aucune fiche d’audit n’est associée à ce modèle.' }, runtime: { protocol: 'unknown', runtimes: [], weights: 'Non documentés', hardwareNotes: 'Non documenté' }, sources: [], auditNotes: 'Modèle enregistré sans fiche d’audit détaillée.',
  };
}

function cloneCard(card: ModelAuditCard): ModelAuditCard {
  return {
    ...card, model: { ...card.model, parameters: card.model.parameters ? { ...card.model.parameters } : undefined }, capabilities: { ...card.capabilities }, lifecycle: [...card.lifecycle], modalities: [...card.modalities], license: { ...card.license }, runtime: { ...card.runtime, runtimes: [...card.runtime.runtimes] }, sources: card.sources.map((source) => ({ ...source })),
  };
}
