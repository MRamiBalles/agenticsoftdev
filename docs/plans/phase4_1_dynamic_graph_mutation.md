# Phase 4.1: Dynamic Graph Mutation

**Status:** IN_PROGRESS  
**Date:** 2026-02-09  
**Compliance:** constitution.md Art. III.1 (No Cycles), Art. V (Structural Integrity)

## Objective

Enable agents to **spawn subtasks at runtime**, dynamically mutating the DAG during execution. This transforms the static task graph into a living structure that adapts to discovered complexity.

## Design Decisions

### 1. Spawn Protocol
- Tasks return an **optional `SpawnRequest[]`** alongside their result.
- Each `SpawnRequest` declares: id, type, agent, payload, dependencies, and parent context scope.
- The DAG engine processes spawns **after** the parent task completes successfully.

### 2. Context Isolation
- Spawned tasks receive a **scoped context snapshot**: parent output + declared payload only.
- No access to sibling task state or the full graph context.
- Prevents token explosion and cross-contamination between subtask branches.

### 3. Recursion Depth Limits
- **Max depth: 3** (configurable). Parent → child → grandchild → great-grandchild.
- Depth tracked per-task via `_depth` metadata field.
- Exceeding depth → spawn rejected with CONSTITUTIONAL_VIOLATION logged.

### 4. Mutation Validation
- Every spawn request is validated:
  - **Cycle detection:** re-run Kahn's on the mutated graph before committing.
  - **RBAC check:** spawning agent must have permission to create the requested task type.
  - **Duplicate ID rejection:** no ID collisions with existing tasks.
  - **Dependency existence:** all declared deps must exist in the graph.

### 5. Architecture

```
TaskDispatcher returns → { result, spawnRequests? }
                              ↓
                    MutationController.evaluate()
                    ├─ depth check
                    ├─ RBAC check  
                    ├─ cycle detection
                    ├─ context isolation
                    └─ inject into live DAGGraph
                              ↓
                    DAGEngine scheduler picks up new PENDING tasks
```

## File Changes

| File | Change |
|:---|:---|
| `src/orchestrator/dag-engine.ts` | Add `SpawnRequest`, `TaskDispatchResult`, `MutationPolicy`, `MutationResult` types. Add `MutationController` class. Extend `execute()` to process spawns. |
| `src/orchestrator/main.ts` | Update `dispatchTask` to return `TaskDispatchResult` with optional spawn requests. |
| `tests/orchestrator/dag-engine.test.ts` | Add mutation tests: spawn injection, depth limit, cycle rejection, context isolation, RBAC enforcement. |
| `docs/security/threat_model.md` | Add §10 Dynamic Mutation risks. |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```
