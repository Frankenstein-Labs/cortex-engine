# Real Integrations

This document describes the real agent runtime integrations implemented in Cortex Engine.

## Overview

The fake adapters have been replaced with real integrations using the official SDKs:
- **Kilo**: `@kilocode/sdk` 7.5.14
- **OpenHands**: `@openhands/typescript-client` 1.39.0

## Architecture

### Unified Agent Runtime Interface

All agent runtimes implement the `AgentRuntimeBridge` interface defined in `packages/core/src/agent-runtime.ts`:

```typescript
export interface AgentRuntimeBridge {
  readonly engine: 'kilo' | 'openhands';
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
  createSession(config: { title?: string; agent?: string; model?: string }): Promise<string>;
  sendPrompt(sessionId: string, prompt: string): Promise<unknown>;
  streamEvents(sessionId: string): AsyncIterable<Record<string, unknown>>;
  getSessionStatus(sessionId: string): Promise<Record<string, unknown>>;
  closeSession(sessionId: string): Promise<void>;
}
```

### Process Manager

A `ProcessManager` in `packages/runtime/src/process-manager.ts` handles spawning, tracking, and killing managed subprocesses (e.g., `kilo serve`, `openhands-agent-server`).

## Kilo Integration

**Package**: `@cortex/kilo-adapter`

**Implementation**: `packages/kilo-adapter/src/kilo-runtime-bridge.ts`

**SDK**: `@kilocode/sdk`

### Features
- Spawns `kilo serve` via `createKiloServer`
- Creates typed client via `createKiloClient`
- Session CRUD via `KiloClient.session.create/get/delete`
- Prompting via `KiloClient.session.prompt`
- SSE event streaming via `KiloClient.event.subscribe`
- Event mapping from Kilo events to Cortex events

### Usage

```typescript
import { KiloRuntimeBridge } from '@cortex/kilo-adapter';

const bridge = new KiloRuntimeBridge({ port: 4096 });
await bridge.start();
const sessionId = await bridge.createSession({ title: 'Task', agent: 'build', model: 'default' });
await bridge.sendPrompt(sessionId, 'Implement feature X');
await bridge.stop();
```

## OpenHands Integration

**Package**: `@cortex/openhands-adapter`

**Implementation**: `packages/openhands-adapter/src/openhands-runtime-bridge.ts`

**SDK**: `@openhands/typescript-client`

### Features
- Optionally spawns `openhands-agent-server` subprocess
- Conversation management via `ConversationManager`
- Remote conversation execution via `RemoteConversation`
- WebSocket real-time events via `WebSocketCallbackClient`
- LLM configuration via `AgentBase` and `LLM` interfaces

### Usage

```typescript
import { OpenHandsRuntimeBridge } from '@cortex/openhands-adapter';

const bridge = new OpenHandsRuntimeBridge({ serverUrl: 'http://localhost:3000' });
await bridge.start();
const conversationId = await bridge.createSession({ title: 'Task', agent: 'default', model: 'gpt-4' });
await bridge.sendPrompt(conversationId, 'Implement feature X');
await bridge.stop();
```

## Adapter Updates

- `KiloAgentAdapter` now delegates session/prompt operations to `KiloRuntimeBridge`
- `OpenHandsAgentAdapter` now delegates session/prompt operations to `OpenHandsRuntimeBridge`
- Fake HTTP calls to `/api/session` and `/api/conversations` have been removed
- All `// Placeholder` and `// TODO: simulate` comments have been removed from production code

## Engine Availability

### Kilo
- `kilo` CLI is available at `/usr/local/bin/kilo`
- Integration tests run real `kilo serve` subprocess

### OpenHands
- `openhands-agent-server` is **not** installed in this environment
- Integration tests skip gracefully when the server binary is unavailable
- The bridge works with any compatible OpenHands Agent Server URL

## Testing

```bash
pnpm build
pnpm test
```

Tests cover:
- `ProcessManager`: spawn, kill, process lifecycle
- `KiloRuntimeBridge`: instantiation, health checks, session lifecycle (with mock SDK)
- `OpenHandsRuntimeBridge`: instantiation, health checks, graceful unavailability handling
