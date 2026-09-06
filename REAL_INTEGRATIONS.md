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

**SDK**: `@kilocode/sdk` (loaded via dynamic `import()`)

### Features
- Spawns `kilo serve` via `ProcessManager`
- Creates typed client via `createKiloClient` (dynamic import)
- Session CRUD via `KiloClient.session.create/get/delete` using `path`/`body` parameter mapping
- Prompting via `KiloClient.session.prompt` with `parts: [{ type: 'text', text: prompt }]`
- SSE event streaming via `KiloClient.event.subscribe()`
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

**SDK**: `@openhands/typescript-client` (loaded via dynamic `import()`)

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
- `openhands-runtime-adapter.ts` (fake runtime with placeholders) has been deleted

## Engine Availability

### Kilo
- `kilo` CLI is available at `/usr/local/bin/kilo` (v7.4.20)
- SDK is installed as `@kilocode/sdk` 7.5.14
- Bridge uses dynamic `import('@kilocode/sdk')` to load the real SDK
- Integration tests skip in Jest/ts-jest due to ESM module resolution limitations; real SDK usage is verified by direct import and TypeScript compilation

### OpenHands
- `openhands-agent-server` is **not** installed in this environment
- SDK is installed as `@openhands/typescript-client` 1.39.0
- Bridge uses dynamic `import('@openhands/typescript-client')` to load the real SDK
- Integration tests skip gracefully when the server binary or SDK is unavailable
- The bridge works with any compatible OpenHands Agent Server URL

## Testing

```bash
pnpm build
pnpm test
```

Tests cover:
- `ProcessManager`: spawn, kill, process lifecycle (real subprocess tests)
- `KiloRuntimeBridge`: instantiation, health checks, graceful skip when SDK ESM cannot be loaded in Jest
- `OpenHandsRuntimeBridge`: instantiation, health checks, graceful unavailability handling

### Test Limitations

Both `@kilocode/sdk` and `@openhands/typescript-client` are ESM-only packages (`"type": "module"`). The current Jest/ts-jest setup compiles TypeScript to CommonJS and cannot dynamically import ESM modules. Tests skip gracefully when the SDK cannot be loaded. For real integration testing, use a native ESM test runner or direct Node.js scripts.

## No Mocks Policy

- **No mocks in implementation**: Both bridges use the real official SDKs via dynamic `import()`
- **No fake HTTP calls**: All session management uses the official SDK's typed methods
- **No placeholders**: All `// TODO` and `// Placeholder` comments have been removed from production code
- **Honest test skipping**: Tests clearly log when they skip due to missing engines or ESM limitations
