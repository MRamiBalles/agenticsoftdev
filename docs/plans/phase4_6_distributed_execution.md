# Phase 4.6: Distributed Execution

**Objective:** Extend the DAG engine to dispatch tasks across multiple worker nodes with load balancing, heartbeat monitoring, and automatic failover for resilient multi-node execution.

## Design Decisions

1. **Worker Registry**
   - Workers register with: id, capabilities (task types), max concurrency, metadata.
   - Heartbeat protocol: workers send heartbeats at configurable intervals (default 5s).
   - Workers marked DEAD after missing N heartbeats (default 3 misses → 15s timeout).
   - Status lifecycle: IDLE → BUSY → DRAINING → DEAD.

2. **Load Balancing Strategies**
   - **ROUND_ROBIN:** Simple rotation across available workers.
   - **LEAST_LOADED:** Dispatch to worker with fewest active tasks.
   - **CAPABILITY_MATCH:** Match task type to worker capabilities + load factor.
   - Strategy is configurable per-engine, hot-swappable at runtime.

3. **Distributed Dispatcher**
   - Wraps the DAG task dispatcher with worker routing.
   - `DispatchRequest` sent to selected worker → worker executes → `DispatchResponse` returned.
   - Timeout per dispatch (default 30s). Timeout → failover to another worker.
   - Retry on worker failure: re-dispatch to different worker (max 2 failover attempts).

4. **Failover Protocol**
   - Worker goes DEAD mid-task → task re-queued to a healthy worker.
   - DRAINING workers finish current tasks but accept no new ones.
   - All failover events logged forensically.

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/distributed-executor.ts` | **NEW** — WorkerRegistry, LoadBalancer, DistributedDispatcher |
| `tests/orchestrator/distributed-executor.test.ts` | **NEW** — Registration, heartbeat, LB strategies, failover, dispatch |
| `docs/security/threat_model.md` | §20–§21: Distributed execution risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```
