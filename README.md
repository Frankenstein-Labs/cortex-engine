# Cortex Engine

**Cortex Engine** est le moteur d'intelligence et d'exécution derrière GitCortex Studio. Il fournit une plateforme multi-agents autonome capable de planifier, exécuter, tester et valider des tâches de développement logiciel complexes.

## Vision

Cortex Engine permet à plusieurs agents intelligents de travailler ensemble comme une équipe de développeurs humains :

1. Comprendre l'objectif de l'utilisateur
2. Analyser le repository et l'environnement
3. Planifier le travail
4. Créer une équipe d'agents spécialisés
5. Attribuer les tâches
6. Exécuter dans des environnements isolés
7. Tester et valider les résultats

## Architecture

Cortex Engine est structuré en couches modulaires :

```
GitCortex Studio (IDE futur)
        │
        │ API / SDK
        ▼
Cortex Engine
        │
        ├── Agent SDK      (abstractions agent/session/task)
        ├── Orchestrator   (planification, parallélisation)
        ├── Runtime        (host, container, VM)
        ├── Tools          (filesystem, terminal, git, browser)
        ├── Event System   (observabilité temps réel)
        └── Permissions    (sécurité granulaire)
```

## Packages

| Package | Description |
|---------|-------------|
| `@cortex/core` | Types, interfaces, event system, permissions, task graph, tool registry |
| `@cortex/agent` | Agent runtime, session manager, agent pool |
| `@cortex/orchestrator` | Orchestrator, agent communication, mission execution |
| `@cortex/runtime` | Runtime interfaces, host runtime |
| `@cortex/tools` | Outils natifs (filesystem, terminal, git) |
| `@cortex/cli` | Interface en ligne de commande |

## Démarrage rapide

```bash
# Installation
pnpm install

# Build
pnpm build

# Lancer une mission
node packages/cli/dist/cli.js run "Explorer le repository et lister les fichiers"

# Informations système
node packages/cli/dist/cli.js info
```

## Concepts clés

### Agent
Un agent possède :
- **ID** et **nom** uniques
- **Rôle** (architecte, développeur, chercheur, testeur, reviewer...)
- **Modèle** et **provider** IA
- **Permissions** et **outils** disponibles
- **Runtime** et **workspace** dédiés
- **Budget** (tokens, tool calls, durée)

### Session
Une session conserve l'historique d'exécution d'un agent :
- Messages
- Actions
- Observations

### Tâche (Task)
Une tâche est une unité de travail avec :
- Dépendances
- Budget
- Timeout
- Priorité

### Orchestrator
L'orchestrateur :
- Crée les agents
- Répartit les tâches
- Gère les dépendances
- Supervise l'exécution
- Produit un résultat final

### Runtime
Le runtime abstrait l'environnement d'exécution :
- **HostRuntime** : exécution locale
- **ContainerRuntime** : conteneur isolé (futur)
- **VMRuntime** : machine virtuelle (futur)

## Sécurité

Cortex Engine traite les agents comme des programmes potentiellement dangereux :

- Permissions granulaires par action (`filesystem.read`, `terminal.execute`, `git.push`, etc.)
- Isolation par agent (worktree, runtime dédié)
- Politique de réseau et de fichiers configurable
- Human-in-the-loop pour les actions sensibles

## Extensibilité

Le système est conçu pour être étendu :

- **Nouveaux runtimes** : implémenter l'interface `Runtime`
- **Nouveaux outils** : implémenter l'interface `Tool`
- **Nouveaux moteurs d'agents** : étendre `BaseAgent` (Kilo, OpenHands adapters futurs)
- **Nouveaux providers** : implémenter `ModelProvider`

## Roadmap

- [x] Phase 0 : Audit et fondations
- [x] Phase 1 : Architecture cible
- [x] Phase 2 : Agent SDK, Event System, Task System, Runtime interfaces
- [ ] Phase 3 : Kilo Adapter
- [ ] Phase 4 : OpenHands Adapter
- [ ] Phase 5 : Multi-Agent avancé (pool dynamique, communication)
- [ ] Phase 6 : Runtime Container et VM
- [ ] Phase 7 : IDE Capabilities (browser, extensions, debugger)
- [ ] Phase 8 : Autonomie (boucle Plan-Execute-Observe-Test-Fix)
- [ ] Phase 9 : End-to-end test réel
- [ ] Phase 10 : Hardening, sécurité, CI, observabilité

## Documentation

- `ARCHITECTURE.md` — Architecture détaillée
- `SECURITY.md` — Modèle de sécurité
- `CONTRIBUTING.md` — Guide de contribution

## Licence

Propriétaire — GitCortex Studio
