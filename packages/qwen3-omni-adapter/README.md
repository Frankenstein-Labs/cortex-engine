# @cortex/qwen3-omni-adapter

Adapter officiel de **Qwen3-Omni** pour Cortex Engine. Il parle à un serveur **vLLM OpenAI-compatible** : Cortex reste léger et le serveur GPU porte les poids et l’inférence multimodale.

## Démarrer le serveur Qwen3-Omni

Sur une machine équipée d’un GPU NVIDIA et du runtime Qwen3-Omni :

```bash
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
  --port 8000 \
  --host 0.0.0.0
```

Suivre la documentation officielle Qwen3-Omni pour l’installation vLLM/Docker et les exigences GPU. Le dépôt Cortex ne télécharge pas les poids automatiquement et ne les inclut pas dans Git.

## Utiliser l’adapter

```ts
import { Qwen3OmniClient } from '@cortex/qwen3-omni-adapter';

const qwen = new Qwen3OmniClient({
  baseUrl: process.env.QWEN3_OMNI_BASE_URL ?? 'http://127.0.0.1:8000/v1',
  model: process.env.QWEN3_OMNI_MODEL ?? 'Qwen/Qwen3-Omni-30B-A3B-Instruct',
});

if (!(await qwen.healthCheck())) {
  throw new Error('Qwen3-Omni is not reachable; start the vLLM server first');
}

const answer = await qwen.complete({
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Décris cette image.' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
    ],
  }],
});
console.log(answer.output);
```

Variables prises en charge : `QWEN3_OMNI_BASE_URL`, `QWEN3_OMNI_MODEL` et `QWEN3_OMNI_API_KEY`.

L’adapter prend en charge le texte, les images, l’audio et la vidéo au format de contenu Chat Completions. Les appels `stream: true` sont réservés à une future API de streaming dédiée ; utilisez `stream: false` pour l’API actuelle.
