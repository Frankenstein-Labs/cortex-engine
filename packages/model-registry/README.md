# @cortex/model-registry

Registre audité des modèles que Cortex peut connaître sans les déclarer interchangeables ni intégrés.

## États du cycle de vie

| État | Signification |
|---|---|
| `DISCOVERED` | Une source officielle identifie le modèle ou la version. |
| `AUDITED` | Les capacités, la licence et les runtimes documentés ont été vérifiés dans les sources officielles. |
| `CONFIGURED` | Le modèle possède une configuration Cortex concrète (identifiant, endpoint ou paramètres), sans preuve d’exécution. |
| `RUNTIME-READY` | Le runtime déclaré est disponible et sain pour ce modèle dans l’environnement ciblé. |
| `INTEGRATED` | Cortex dispose d’un chemin d’exécution réel et testé pour ce modèle. |
| `VERIFIED` | L’intégration a été vérifiée par un test d’inférence Cortex reproductible. |

Une fiche peut être `AUDITED` sans être `CONFIGURED`, `RUNTIME-READY`, `INTEGRATED` ou `VERIFIED`. Le registre ne crée aucun runtime et ne télécharge aucun poids.

## Modèles couverts

Le registre contient six fiches officielles : Qwen3-Omni, Kimi K2, Kimi K2.5, Kimi K3, GLM-5.3 et DeepSeek-V4-Pro. Seul Qwen3-Omni est actuellement `INTEGRATED` et `VERIFIED` dans Cortex ; les cinq autres sont des candidats audités et ne sont pas routables par `listRoutable()`.
