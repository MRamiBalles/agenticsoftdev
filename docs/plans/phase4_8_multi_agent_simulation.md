# Phase 4.8: Multi-Agent Simulation Sandbox

**Objective:** Provide a simulation harness with configurable mock agents to run the full pipeline end-to-end (DAG + bus + negotiation + learning + persistence + distributed + healing) and observe emergent multi-agent behaviors before production.

## Design Decisions

1. **Simulated Agents**
   - `SimAgent`: configurable mock agent with role, reliability (0–1), speed profile, failure mode.
   - Agents produce deterministic or stochastic results based on their profile.
   - Support for injecting faults: crash rate, timeout rate, OOM rate.

2. **Simulation Engine**
   - Wires together all subsystems: EventBus, NegotiationEngine, TaskAuction, OutcomeTracker, AdaptationEngine, CheckpointManager, WorkerRegistry, FailureDetector, HealingEngine.
   - Runs a DAG through the full pipeline with simulated agents.
   - Collects all events into a timeline for post-hoc analysis.

3. **Scenarios**
   - Predefined scenarios: HAPPY_PATH, CASCADING_FAILURE, NEGOTIATION_DEADLOCK, HEALING_RECOVERY, HIGH_CONTENTION.
   - Each scenario configures agents, DAG, and fault injection to test specific behaviors.
   - Custom scenarios via `SimScenario` interface.

4. **Metrics**
   - Task throughput, success rate, avg latency, healing rate, escalation count.
   - Per-agent metrics: tasks completed, failures, healed, escalated.
   - Timeline of all events for replay analysis.

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/simulation-sandbox.ts` | **NEW** — SimAgent, SimulationEngine, ScenarioRunner, SimMetrics |
| `tests/orchestrator/simulation-sandbox.test.ts` | **NEW** — Lifecycle, scenarios, metrics, fault injection |
| `docs/security/threat_model.md` | §24–§25: Simulation-specific risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```
