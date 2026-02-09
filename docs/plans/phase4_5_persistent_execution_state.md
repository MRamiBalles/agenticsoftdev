# Phase 4.5: Persistent Execution State

**Objective:** Serialize/deserialize DAG state, agent profiles, and bus messages to disk for crash recovery, session resume, and execution replay with SHA-256 integrity verification.

## Design Decisions

1. **Checkpoint Model**
   - `ExecutionSnapshot` captures: DAG graph (task states, results), execution metadata (order, retries, spawned), agent profiles, bus message log, timestamp.
   - Snapshots serialized as JSON with SHA-256 hash for tamper detection.
   - Checkpoint directory: `.ai/checkpoints/` with timestamped filenames.

2. **Checkpoint Policy**
   - Auto-checkpoint after every N completed tasks (default: 5).
   - Manual checkpoint via `CheckpointManager.save()`.
   - Max checkpoints retained (default: 10). Oldest auto-pruned.
   - Configurable checkpoint directory.

3. **Restore & Resume**
   - `RestoreEngine.load()` reads checkpoint, verifies SHA-256 hash, deserializes.
   - Corrupted checkpoints → `INTEGRITY_VIOLATION` with details.
   - Partial restore: completed tasks marked done, pending/failed tasks re-queued.
   - Resume creates a new DAG execution from the restored state.

4. **Execution Replay**
   - Replay mode: re-emit all recorded events (dispatch, complete, fail, spawn, message) in order.
   - Callbacks fire for each replayed event — enables forensic analysis without re-execution.
   - Dry-run: no side effects, just event replay.

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/execution-persistence.ts` | **NEW** — CheckpointManager, RestoreEngine, ExecutionReplay |
| `tests/orchestrator/execution-persistence.test.ts` | **NEW** — Save/load, integrity, corruption, partial restore, replay |
| `docs/security/threat_model.md` | §18–§19: Persistence-specific risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```
