# Phase 4.0: DAG Orchestration — El Motor Agéntico

**Version:** 1.0
**Date:** 2026-02-09
**Authority:** `constitution.md` Art. V (Structural Integrity)
**Prerequisite:** Phase 3.1 (RAG Mnemosyne) — Complete

## Objective
Evolucionar de ejecución lineal a un motor de grafos dirigidos acíclicos (DAG) con ejecución paralela, self-healing, y bucles de retroalimentación cerrados.

## Architecture

```
                    ┌──────────────┐
                    │  DAG Engine  │
                    │  (Scheduler) │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ PLAN   │  │ CODE_A │  │ CODE_B │  ← parallel
         │ (arch) │  │ (build)│  │ (build)│
         └───┬────┘  └───┬────┘  └───┬────┘
             │            │            │
             ▼            └─────┬──────┘
        ┌────────┐              ▼
        │ REVIEW │        ┌──────────┐
        │ (guard)│        │  AUDIT   │
        └───┬────┘        │ (guard)  │
            │             └────┬─────┘
            ▼                  │
       ┌─────────┐            │
       │ DEPLOY  │◄───────────┘
       │ (human) │
       └─────────┘
```

## Components

### 1. DAG Engine (`src/orchestrator/dag-engine.ts`)
Core execution engine with:
- **Topological sort** for execution order
- **Cycle detection** (constitutional violation: Art. III.1)
- **Parallel dispatch** of independent tasks (no shared dependencies)
- **Concurrency limit** (configurable, default: 3)
- **Event emitter** for observability

### 2. Retry Policy (`src/orchestrator/retry-policy.ts`)
Self-healing mechanism:
- **Configurable retry count** per task type (default: 2 for CODE, 0 for PLAN)
- **Feedback injection**: on failure, error output is injected into retry payload
- **Exponential backoff** with jitter
- **Circuit breaker**: after N consecutive failures, halt and escalate to human
- **Diagnostic routing**: failed AUDIT → re-route to Builder with fix instructions

### 3. Refactored Orchestrator (`src/orchestrator/main.ts`)
- Replace `executeLoop()` with `dagEngine.execute(graph)`
- Keep all Phase 3/3.1 integrations (SecurityGate, PlanningGate, ForensicLogger)
- Add graph construction from task definitions
- Add shutdown hook for session compaction

## Task Types (Extended)

| Type | Agent | Retryable | Parallel |
|:---|:---|:---|:---|
| `PLAN` | architect | No | No (sequential gate) |
| `CODE` | builder | Yes (2x) | Yes |
| `AUDIT` | guardian | No | Yes |
| `TEST` | guardian | Yes (1x) | Yes |
| `REVIEW` | guardian | No | No |
| `DEPLOY` | human | No | No |

## File Changes
- [NEW] `src/orchestrator/dag-engine.ts`
- [NEW] `src/orchestrator/retry-policy.ts`
- [MODIFY] `src/orchestrator/main.ts`
- [NEW] `tests/orchestrator/dag-engine.test.ts`

## Verification Strategy
- [ ] Unit: Topological sort produces correct order
- [ ] Unit: Cycle detection rejects invalid graphs
- [ ] Unit: Parallel tasks execute concurrently up to limit
- [ ] Unit: Retry injects error feedback into payload
- [ ] Unit: Circuit breaker halts after threshold
- [ ] Integration: Full graph executes through Security + Memory pipelines
- [ ] Regression: Phase 3 + 3.1 tests still pass (39/39)
