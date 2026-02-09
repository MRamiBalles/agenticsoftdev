# Phase 4.2: Agent Communication Protocol

**Objective:** Enable agents to communicate during DAG execution via a typed pub/sub event bus and scoped message channels, supporting coordination primitives for multi-agent workflows.

## Design Decisions

1. **Event Bus (Pub/Sub)**
   - In-process, zero-dependency event bus (no Redis/external services)
   - Typed topics: `task.completed`, `task.failed`, `task.spawned`, `agent.signal`, `agent.broadcast`
   - RBAC: publish/subscribe permissions per agent role
   - Message size limit: 10KB per message (prevents context bombing)
   - Message TTL: messages expire after configurable duration (default 60s)
   - Forensic logging: all messages recorded in the ledger

2. **Message Channels (Direct Communication)**
   - Scoped channels: agent-to-agent or topic-based groups
   - Channel isolation: agents can only read channels they're subscribed to
   - Buffered channels with configurable max depth (default 100 messages)
   - Drain semantics: consumers can drain all pending messages

3. **Coordination Primitives**
   - **Barrier:** N agents must signal before execution continues
   - **Signal:** One-shot notification from one agent to others
   - **SharedContext:** Read-only shared state visible to subscribed agents (capped size)

4. **Integration with DAG Engine**
   - `TaskDispatchResult` extended with optional `messages` field
   - EventBus injected into dispatcher context via `AgentContext`
   - Tasks receive a scoped `AgentMailbox` — can publish, subscribe, and read messages
   - All bus activity logged via `onMessage` callback

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/agent-bus.ts` | **NEW** — EventBus, AgentMailbox, ChannelManager, coordination primitives |
| `src/orchestrator/dag-engine.ts` | Extend `TaskDispatchResult` with messages; add `AgentContext` to dispatcher |
| `src/orchestrator/main.ts` | Wire EventBus into dispatcher; log message events |
| `tests/orchestrator/agent-bus.test.ts` | **NEW** — pub/sub, RBAC, channels, barriers, message limits |
| `docs/security/threat_model.md` | §12–§13: Communication-specific risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```

All existing tests must continue passing. New tests cover: pub/sub delivery, topic filtering, RBAC enforcement, message size rejection, channel isolation, barrier synchronization, and forensic logging of messages.
