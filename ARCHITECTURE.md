# Cortex Engine — Architecture

## Vue d'ensemble

Cortex Engine est un moteur multi-agents autonome conçu pour exécuter des missions de développement logiciel complexes. Il sépare strictement les responsabilités en couches indépendantes.

## Couches

### 1. Agent SDK Layer

Abstractions pures sans dépendance à un moteur spécifique :

```
Agent
 ├── config (rôle, modèle, permissions, outils, runtime, workspace)
 ├── state (statut, itérations, tokens, coût)
 ├── session (messages, actions, observations)
 └── execute(task) → TaskResult

Session
 ├── messages[]
 ├── actions[]
 └── observations[]

Task
 ├── status, priority, dependencies
 ├── budget (tokens, tool calls, durée)
 └── result, error
```

### 2. Orchestration Layer

```
Orchestrator
 ├── AgentPool
 │    ├── createAgent(config)
 │    ├── assignTask(task, agentId)
 │    └── getAvailableAgents(role)
 ├── TaskGraph
 │    ├── addTask(), addDependency()
 │    ├── getReadyTasks()
 │    └── markTaskStatus()
 ├── AgentCommunication
 │    ├── send(from, to, message)
 │    ├── broadcast(from, message, recipients)
 │    └── postToSharedArtifact()
 └── submitMission(mission) → MissionResult
```

### 3. Runtime Layer

Interface `Runtime` avec implémentations :

```
Runtime (interface)
 ├── executeCommand(command, args, env) → CommandResult
 ├── readFile(path) / writeFile(path, content)
 ├── startProcess(command) → ProcessHandle
 ├── openBrowser(url)
 └── takeScreenshot()

HostRuntime        — exécution sur la machine hôte
ContainerRuntime   — exécution dans un conteneur (futur)
VMRuntime          — exécution dans une VM (futur)
RemoteRuntime      — exécution sur un serveur distant (futur)
```

### 4. Tools Layer

Chaque outil déclare :

```ts
interface Tool {
  name: string;
  description: string;
  version: string;
  parameters: ToolParameter[];
  requiredPermissions: PermissionAction[];
  runtimeRequirements: RuntimeCapability[];
  execute(params, context) → Promise<ToolResult>;
}
```

Outils natifs :

- `filesystem.read` / `filesystem.write` / `filesystem.list` / `filesystem.delete`
- `terminal.execute`
- `git.status` / `git.diff` / `git.commit`

### 5. Event System

Toutes les actions produisent des événements :

```
AgentStarted, AgentStopped, TaskCreated, TaskAssigned,
ToolCalled, ToolCompleted, RuntimeStarted, RuntimeStopped,
CommandExecuted, FileChanged, TestStarted, TestCompleted,
ErrorDetected, ReviewCompleted, PermissionDenied
```

L'`EventBus` permet à GitCortex Studio de recevoir un flux temps réel.

### 6. Permission System

Permissions granulaires :

```
Permission { action, resource?, effect }
Policy { permissions[], defaultEffect }
```

Actions supportées :
- `filesystem.read`, `filesystem.write`, `filesystem.delete`
- `terminal.execute`
- `git.push`, `git.merge`, `git.rebase`
- `network.access`, `browser.use`
- `extension.install`
- `vm.create`, `vm.start`, `vm.stop`
- `secret.access`, `deploy`, `admin`

## Flux d'exécution

```
Mission
  │
  ▼
Orchestrator
  │
  ├── TaskGraph (dépendances)
  │
  ├── AgentPool
  │     ├── Agent #1 (Architecte)
  │     ├── Agent #2 (Développeur)
  │     └── Agent #3 (Testeur)
  │
  └── Pour chaque tâche prête :
        ├── Agent.execute(task)
        │     ├── Planification
        │     ├── Appels d'outils
        │     └── Observations
        │
        ├── Vérification
        └── Rapport
```

## Isolation

Chaque agent peut recevoir :
- Un **workspace** dédié (worktree Git)
- Un **runtime** dédié (host, container, VM)
- Des **permissions** spécifiques

Exemple d'isolation :

```
Agent A → Worktree A → HostRuntime A
Agent B → Worktree B → HostRuntime B
Agent C → Worktree C → VMRuntime C
```

## Extensibilité

Le système prévoit des adapters pour :

- **Kilo** : moteur d'agents existant
- **OpenHands** : capacités d'exécution et de navigation
- **Futurs moteurs** : via l'interface `Agent`

Un adapter implémente `Agent` en déléguant au moteur sous-jacent.

## Storage

Actuellement :
- `InMemoryStore` pour la mémoire
- `InMemoryEventBus` pour les événements
- `InMemoryTaskGraph` pour les tâches

Futur :
- Stockage persistant (SQLite, PostgreSQL)
- Event stream persistant
- Checkpoint / reprise
