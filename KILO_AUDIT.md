# Kilo Audit

## Repository
`Frankenstein-Labs/kilocode` — cloned to `/tmp/kilocode-audit`

## Monorepo Structure
pnpm + Turborepo, 35 packages under `packages/`.

| Package | Purpose |
|---------|---------|
| `@opencode-ai/core` | Core domain: agents, sessions, events, tools, permissions, PTY, DB |
| `@opencode-ai/server` | HTTP API server (Effect HttpApiBuilder) |
| `@opencode-ai/protocol` | HTTP API route definitions, middleware |
| `@opencode-ai/schema` | Effect schemas for all domain types |
| `@opencode-ai/llm` | LLM abstraction: providers, protocols, streaming |
| `@opencode-ai/client` | Generated HTTP/SSE client |
| `@opencode-ai/tui` | Terminal UI (Ink) |
| `@opencode-ai/ui` | Shared UI components |
| `@kilocode/cli` | CLI entrypoint (`kilo` binary) |
| `@kilocode/plugin` | Plugin SDK: tools, TUI hooks, workspace adapters |
| `@kilocode/sandbox` | OS-neutral sandbox profiles |
| `@kilocode/kilo-memory` | Project memory storage, indexing, recall |
| `@kilocode/kilo-indexing` | Standalone indexing engine |
| `@kilocode/kilo-gateway` | Unified gateway: auth, provider, API |
| `kilo-code` | VS Code extension |
| `@kilocode/kilo-jetbrains` | JetBrains plugin |
| `@kilocode/kilo-console` | Local web console (SolidJS) |

## Agent System

### Core Agent (V2)
- `packages/core/src/agent.ts` — `AgentV2.Service` (Effect `Context.Service`)
- Manages `Map<ID, Info>` in a `State`-based draft pattern
- `AgentV2.ID` — branded string ID (default: `"build"`)
- `AgentV2.Info` — schema class with `model`, `variant`, `request`, `system`, `description`, `mode` (`subagent` | `primary` | `all`), `hidden`, `color`, `steps`, `disabled`, `permissions`
- 30+ built-in provider plugins

### Agent Config
```ts
export class Info extends Schema.Class<Info>("ConfigV2.Agent")({
  model: Schema.String.pipe(Schema.optional),
  variant: Schema.String.pipe(Schema.optional),
  request: ConfigProvider.Request.pipe(Schema.optional),
  system: Schema.String.pipe(Schema.optional),
  description: Schema.String.pipe(Schema.optional),
  mode: Schema.Literals(["subagent", "primary", "all"]).pipe(Schema.optional),
  hidden: Schema.Boolean.pipe(Schema.optional),
  color: Color.pipe(Schema.optional),
  steps: PositiveInt.pipe(Schema.optional),
  disabled: Schema.Boolean.pipe(Schema.optional),
  permissions: Permission.Ruleset.pipe(Schema.optional),
}) {}
```

## Session System

### Session Management
- `packages/core/src/session.ts` — `SessionV2.Service`
- `packages/core/src/session/store.ts` — Session store (DB reads)
- `packages/core/src/session/sql.ts` — Drizzle ORM schema
- `packages/core/src/session/schema.ts` — Session domain schema
- `packages/core/src/session/runner/` — The actual run loop

### Session Interface
```ts
export interface Interface {
  readonly list: (input?: ListInput) => Effect.Effect<SessionSchema.Info[]>
  readonly create: (input: CreateInput) => Effect.Effect<SessionSchema.Info>
  readonly get: (sessionID) => Effect.Effect<SessionSchema.Info, NotFoundError>
  readonly messages: (...) => Effect.Effect<SessionMessage.Message[], ...>
  readonly context: (sessionID) => Effect.Effect<SessionMessage.Message[], ...>
  readonly events: (input) => Stream.Stream<SessionDurableEvent, NotFoundError>
  readonly history: (input) => Effect.Effect<{ events, hasMore }, NotFoundError>
  readonly switchAgent: (input) => Effect.Effect<void>
  readonly switchModel: (input) => Effect.Effect<void>
  readonly prompt: (input) => Effect.Effect<SessionInput.Admitted, ...>
  readonly shell: (input) => Effect.Effect<void>
  readonly skill: (input) => Effect.Effect<void>
  readonly compact: (input) => Effect.Effect<void>
  readonly wait: (id) => Effect.Effect<void>
  readonly active: Effect.Effect<ReadonlySet<SessionSchema.ID>>
  readonly resume: (sessionID) => Effect.Effect<void>
  readonly interrupt: (sessionID) => Effect.Effect<void>
  readonly revert: { stage, clear, commit }
}
```

### Session Runner
- `packages/core/src/session/runner/llm.ts` — `runTurn` loads history, resolves model, materializes tools, streams one LLM turn
- Tool calls settled eagerly via `FiberSet`, with `Semaphore`-guarded publishing
- Supports compaction on context overflow, step limits per agent, interruption
- After each turn, checks `needsContinuation` and loops

## Tool System

### Tool Registry
- `packages/core/src/tool/registry.ts` — `ToolRegistry.Service`
- `register(tools)` — registers tools into a scoped local map
- `materialize(permissions?)` — returns `{ definitions, settle }`

### Tool Definition DSL
```ts
export function make<Input, Output>(config: {
  description: string
  input: Input      // Effect Schema
  output: Output    // Effect Schema
  execute: (input, context: Context) => Effect.Effect<Output, ToolFailure>
}): Definition<Input, Output>
```

### Built-in Tools
- `ApplyPatchTool`, `BashTool`, `EditTool`, `GlobTool`, `GrepTool`, `QuestionTool`, `ReadTool`, `SkillTool`, `TodoWriteTool`, `WebFetchTool`, `WebSearchTool`, `WriteTool`

### Tool Execution in Sessions
1. `SessionTools.resolve()` collects tools from registry, plugins, MCP
2. Each tool wrapped with `ProviderTransform.schema()` for provider-specific transforms
3. Tools registered as `ai` SDK tools
4. On execution, `SandboxPolicy.executeTool()` runs the tool

## Events / Streaming

### Event Bus
- `packages/core/src/event.ts` — Built on Effect's `PubSub` and `Queue`
- Supports **durable** and **non-durable** events
- Durable events persisted to SQLite with sequence numbers per aggregate
- `publish(definition, data, options?)` — publishes event; durable events committed transactionally
- `publishAll(entries)` — batch publish
- `subscribe(definition)` — typed `Stream.Stream<Payload>`
- `all()` — unbounded stream of all events
- `durable({ aggregateID, after? })` — durable event stream
- `listen(listener)` — global listener registration
- `project(definition, projector)` — register projector
- `replay(event)` / `replayAll(events)` — replay serialized events

### Session Events
- `Prompted`, `PromptAdmitted`, `AgentSwitched`, `ModelSwitched`, `Moved`
- `Step.Started/Ended/Failed`
- `Text.Started/Delta/Ended`, `Reasoning.Started/Delta/Ended`
- `Tool.Input.Started/Delta/Ended`, `Tool.Called`, `Tool.Progress`, `Tool.Success`, `Tool.Failed`
- `Compaction.Started/Ended`, `Synthetic`, `ContextUpdated`

### SSE Streaming
- `packages/server/src/handlers/event.ts` — `event.subscribe` GET `/api/event`
- Uses `EventV2.allBounded(events, 256)` for bounded live stream
- 15-second heartbeat
- SSE encoding via `effect/unstable/encoding/Sse`

## MCP Integration
- `packages/opencode/src/mcp/index.ts` — Main MCP service
- Supports three transports: Local (stdio), Remote (HTTP/SSE)
- OAuth support with dynamic client registration
- Docker awareness (injects `--rm` flag)
- `packages/opencode/src/mcp/catalog.ts` — Tool catalog/conversion
- MCP tools converted to `ai` SDK `Tool` using `dynamicTool()`

## SDK Public API
```ts
// packages/sdk/js/src/index.ts
export async function createKilo(options?: ServerOptions) {
  const server = await createKiloServer({ ...options })
  const client = createKiloClient({ baseUrl: server.url })
  return { client, server }
}
```

### Client
- Generated fetch client with SSE streaming support
- `event.subscribe` returns `AsyncIterable<OpenCodeEvent>`
- Error handling with `ClientError` types

### Server
- Spawns `kilo serve --hostname=... --port=...` as child process
- Parses `kilo server listening on https://...` from stdout
- Supports `KILO_CONFIG_CONTENT` env injection

## Server / Transport
- Built on Effect's `HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" })`
- Protocol API groups: Health, Location, Agent, Session, Message, Model, Provider, Integration, Credential, Permission, FileSystem, Command, Skill, Event, Pty, Question, Reference, ProjectCopy

## Models / Providers
- `packages/llm/src/llm.ts` — `LLMClient` with `stream(request)` and `generate(request)`
- Route system: `Route`, `LLMClient`, transports (HTTP, WebSocket)
- Protocol mappers: OpenAI Chat, OpenAI Responses, Anthropic Messages, Gemini, Bedrock, OpenAI Compatible
- 30+ provider plugins for catalog management
- Model resolution in session runner: resolves catalog model, applies variant overrides, merges credentials

## Key Integration Points for Cortex
1. **Effect Layer System**: Services composed via `Layer.provide`, `Layer.mergeAll`, `LayerNode`
2. **Location System**: Services scoped to a `Location` (directory + workspaceID)
3. **Database**: SQLite via Drizzle ORM
4. **PTY**: `packages/core/src/pty/` — PTY abstraction with Bun and Node implementations
5. **Filesystem**: `packages/core/src/filesystem/` — filesystem abstraction
6. **Permission**: `packages/core/src/permission/` — permission rulesets
7. **Plugin System**: `packages/plugin/` — Plugin SDK for extending tools, auth, workspace adapters
8. **Kilo Memory**: `packages/kilo-memory/` — Project memory with capture, digest, decisions
9. **Kilo Indexing**: `packages/kilo-indexing/` — Standalone indexing engine
10. **Sandbox**: `packages/kilo-sandbox/` — OS-neutral sandbox profiles

## Decision: KEEP / REFACTOR / MERGE / REPLACE / REMOVE

| Component | Decision | Rationale |
|-----------|----------|-----------|
| `@cortex/core` types (Agent, Session, Task, Event, Tool, Permission) | **MERGE** | Kilo's schemas are robust; Cortex can re-export or adapt them |
| `@cortex/agent` BaseAgent | **KEEP** | Kilo's agent system is Effect-based; Cortex needs a non-Effect abstraction |
| `@cortex/orchestrator` DefaultOrchestrator | **KEEP** | Orchestration is Cortex's core value; Kilo doesn't have this |
| `@cortex/runtime` HostRuntime | **KEEP** | Kilo uses PTY/Bun-specific APIs; Cortex needs portable runtime |
| `@cortex/tools` | **REFACTOR** | Kilo's tools are more complete; Cortex tools should delegate |
| Event system | **MERGE** | Kilo's event bus is production-grade; Cortex can wrap it |
| Permission system | **MERGE** | Kilo's permission rulesets are robust |
| MCP integration | **REPLACE** | Kilo has real MCP; Cortex should delegate to Kilo's MCP service |

## Next Steps
1. Create `packages/kilo-adapter` that bridges Kilo SDK into Cortex interfaces
2. Create `packages/openhands-adapter` that bridges OpenHands API into Cortex interfaces
3. Create `packages/vm-runtime` that wraps GitCortex VM implementation
4. Update `@cortex/core` to import Kilo schemas where appropriate
