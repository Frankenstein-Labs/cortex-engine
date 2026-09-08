# Audit des modèles pour Cortex AI

**Date de l’audit : 8 septembre 2026.** Les dépôts ont été clonés dans `/home/ubuntu/model-audit/`, en dehors du monorepo Cortex. Les poids ne sont pas copiés dans Git.

## Conclusion opérationnelle

Qwen3-Omni est le seul modèle de cette liste actuellement intégré et testé dans Cortex. L’intégration est réelle au niveau du runtime HTTP/vLLM et du chemin CLI `cortex run --agent qwen3-omni`, mais l’inférence GPU doit être exécutée sur une machine disposant du runtime Qwen/vLLM et des poids téléchargés séparément.

Les autres modèles ne doivent pas être déclarés comme intégrés tant que leur runtime officiel, leur format d’appel, leur licence et un test d’inférence n’ont pas été vérifiés dans Cortex. Un registre peut les décrire comme candidats audités, mais il ne doit pas faire croire qu’ils sont interchangeables avec Qwen3-Omni.

## Matrice d’audit

| Modèle | Dépôt officiel | État vérifié | Runtime / poids | Décision Cortex |
|---|---|---|---|---|
| Qwen3-Omni | [QwenLM/Qwen3-Omni](https://github.com/QwenLM/Qwen3-Omni) | Dépôt cloné et README vérifié | `Qwen/Qwen3-Omni-30B-A3B-Instruct`; Transformers et vLLM documentés; téléchargements Hugging Face/ModelScope documentés; texte, image, audio, vidéo, sortie texte/audio | **Intégré** via `@cortex/qwen3-omni-adapter` et `Qwen3OmniAgent` |
| Kimi K3 | [MoonshotAI/Kimi-K3](https://github.com/MoonshotAI/Kimi-K3) | Dépôt officiel existant, cloné; audit runtime détaillé à poursuivre | Le dépôt publie une licence et un rapport technique; le format d’inférence et les exigences matérielles doivent être validés avant branchement | **Candidat — non intégré** |
| Kimi K2.5 | [MoonshotAI/Kimi-K2.5](https://github.com/MoonshotAI/Kimi-K2.5) | Dépôt officiel existant, cloné; README décrit un modèle multimodal agentique | Déploiement documenté dans `docs/deploy_guidance.md`; licence et appel de production doivent être validés dans un test Cortex | **Candidat multimodal — non intégré** |
| Kimi K2 | [MoonshotAI/Kimi-K2](https://github.com/MoonshotAI/Kimi-K2) | Dépôt officiel existant, cloné; README et guide tool-call disponibles | Le dépôt documente l’usage OpenAI-compatible et la boucle `tool_calls`; les poids et le serveur restent externes | **Candidat coding/tool-use — non intégré** |
| GLM historique | [THUDM/GLM](https://github.com/THUDM/GLM) | Dépôt officiel existant mais ancien et orienté framework/anciens checkpoints | Ne pas sélectionner automatiquement ce dépôt comme modèle moderne; il ne représente pas à lui seul la génération GLM actuelle | **Référence historique — non intégré** |
| GLM-5.3 | [zai-org/GLM-5](https://github.com/zai-org/GLM-5) | Dépôt officiel actuel cloné; README documente GLM-5.2/5.3 et plusieurs runtimes | vLLM, SGLang, Transformers et autres runtimes référencés; la licence et le profil GPU doivent être validés avant intégration | **Sixième modèle retenu pour l’audit approfondi; non intégré** |

## Faits confirmés pour Qwen3-Omni

Le dépôt officiel décrit `Qwen3-Omni-30B-A3B-Instruct`, `Qwen3-Omni-30B-A3B-Thinking` et `Qwen3-Omni-30B-A3B-Captioner`. Il fournit des exemples Transformers et vLLM, un toolkit de traitement multimodal, des démonstrations audio/visuelles et une image Docker officielle. Le README documente le téléchargement des poids via Hugging Face ou ModelScope et recommande une version récente de Transformers ainsi que l’installation de `ffmpeg` pour les entrées multimodales.

Cortex utilise actuellement l’endpoint vLLM OpenAI-compatible pour maintenir une frontière claire entre le moteur TypeScript et le runtime GPU Python/CUDA. Cette frontière permet de remplacer vLLM par Transformers ou un serveur officiel ultérieurement sans exposer les dépendances CUDA dans le monorepo.

## Ce qui n’est pas encore déclaré comme terminé

Les fonctionnalités suivantes exigent encore du code et des tests dédiés : registre multi-modèles avec métadonnées de licence, interface runtime commune `load/unload/health/generate/stream`, routeur fondé sur les capacités, conversation persistante, mémoire de projet, boucle tool-call modèle → outil → observation, planification multi-tâches, vérification et auto-correction. La présence des packages historiques `@cortex/kilo-adapter` et `@cortex/openhands-adapter` ne constitue pas une preuve que ces capacités sont déjà unifiées dans une boucle autonome.

## Étapes suivantes recommandées

1. Extraire dans `@cortex/model-runtime` l’interface commune et un runtime OpenAI-compatible réutilisable.
2. Créer `@cortex/model-registry` avec des fiches explicites, un statut d’intégration et des licences sourcées.
3. Ajouter un `@cortex/model-router` qui sélectionne uniquement les modèles dont le runtime est sain et dont les capacités correspondent à la mission.
4. Implémenter la boucle conversation → plan → outil → observation → vérification, d’abord avec Qwen3-Omni et les outils Cortex existants.
5. Intégrer GLM-5.3 ou Kimi K2 seulement après un test d’inférence réel, une vérification de licence et une mesure des exigences matérielles.

## Sources officielles

- [Qwen3-Omni — dépôt officiel](https://github.com/QwenLM/Qwen3-Omni)
- [Qwen3-Omni-Instruct — modèle officiel Hugging Face](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct)
- [Kimi K3 — dépôt officiel](https://github.com/MoonshotAI/Kimi-K3)
- [Kimi K2.5 — dépôt officiel](https://github.com/MoonshotAI/Kimi-K2.5)
- [Kimi K2 — dépôt officiel](https://github.com/MoonshotAI/Kimi-K2)
- [GLM historique — dépôt THUDM](https://github.com/THUDM/GLM)
- [GLM-5 — dépôt officiel zai-org](https://github.com/zai-org/GLM-5)
