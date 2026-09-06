# OpenHands / OpenDevine Audit

## Repository
`Frankenstein-Labs/OpenHands` — cloned to `/tmp/openhands-audit`

## Important Finding
The cloned repository is **OpenHands Agent Canvas UI** — the web frontend only.
The actual agent runtime engine is in a **separate backend repository** (`openhands-agent-server`).

## Frontend Structure (Agent Canvas UI)

### Package
- `@openhands/agent-canvas` v1.15.0
- Next.js / React application
- TypeScript, not Effect-TS

### Key API Services
| Service | Purpose |
|---------|---------|
| `agent-server-adapter.ts` | Adapter for communicating with agent server |
| `backend-registry/` | Manages multiple backend URLs, health, auth |
| `conversation-service/` | Conversation/chat with agent server |
| `runtime-service/` | Runtime environment management |
| `workspaces-service/` | Workspace file operations |
| `git-service/` | Git operations |
| `mcp-service/` | MCP server management |
| `bash-service/` | Bash/terminal execution |
| `event-service/` | Event streaming from backend |
| `agent-profiles-service/` | Agent profile management |
| `settings-service/` | Settings management |
| `plugins-service/` | Plugin management |
| `skills-service/` | Skills management |
| `cloud/` | Cloud-specific APIs |

### Communication Pattern
- Frontend communicates with backend via HTTP/WebSocket
- Backend URL configured in `backend-registry`
- No direct agent runtime in frontend

## What We Need From OpenHands

The actual OpenHands agent runtime is in `openhands-agent-server` (Python-based). We need to:
1. Clone `openhands-agent-server` separately
2. Audit its agent, session, event, action, observation, runtime, sandbox, browser, terminal, MCP implementations
3. Determine if we can run it as a subprocess or via its API

## OpenHands Capabilities We Need

| Capability | Where It Lives | Notes |
|------------|---------------|-------|
| Agent execution | `openhands-agent-server` | Python runtime |
| Session management | `openhands-agent-server` | Conversation state |
| Event streaming | `openhands-agent-server` | WebSocket/SSE |
| Sandbox/container | `openhands-agent-server` | Docker-based isolation |
| Browser automation | `openhands-agent-server` | Playwright-based |
| Terminal/PTY | `openhands-agent-server` | Docker exec |
| Git operations | `openhands-agent-server` | Via runtime |
| MCP | `openhands-agent-server` | MCP client |
| File operations | `openhands-agent-server` | Via runtime workspace |

## Decision: KEEP / REFACTOR / MERGE / REPLACE / REMOVE

| Component | Decision | Rationale |
|-----------|----------|-----------|
| `@cortex/core` types | **KEEP** | Kilo's Effect-TS types are solid; OpenHands uses Python |
| `@cortex/agent` | **KEEP** | Need non-Effect abstraction |
| `@cortex/runtime` | **REFACTOR** | Will add container/VM runtimes |
| OpenHands API client | **NEW** | Create HTTP/WebSocket client for `openhands-agent-server` |
| OpenHands adapter | **NEW** | Bridge OpenHands backend into Cortex interfaces |

## Next Steps
1. Clone `openhands-agent-server` from `Frankenstein-Labs`
2. Audit its Python code for agent, session, runtime, sandbox
3. Determine integration points (subprocess vs HTTP API)
4. Build `packages/openhands-adapter`
