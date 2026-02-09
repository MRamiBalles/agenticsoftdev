# Phase 4.4: Agent Learning & Adaptation

**Objective:** Enable agents to learn from past task outcomes, adapt retry strategies, improve auction bid accuracy, and optimize task routing based on accumulated performance history.

## Design Decisions

1. **Outcome Tracking**
   - Every task completion/failure records a `TaskOutcome` with: agent, type, duration, exitCode, retryCount, depth.
   - Rolling window of last N outcomes per agent+taskType pair (default: 50).
   - Metrics computed: success rate, avg duration, p95 duration, retry rate, failure patterns.

2. **Agent Profiles**
   - Each agent accumulates an `AgentProfile` with per-task-type performance stats.
   - Profiles decay over time (exponential decay, half-life configurable) to favor recent performance.
   - Profiles are read-only externally — only the learning engine writes.

3. **Adaptation Strategies**
   - **Retry Tuning:** If an agent's success rate on retries for a task type is <20%, reduce max retries. If >80%, allow more.
   - **Bid Calibration:** Auction bids auto-adjust capability score and duration estimate based on historical accuracy.
   - **Task Affinity:** Recommend best agent for a task type based on historical success rate and speed.
   - **Failure Pattern Detection:** Identify recurring error patterns (same stderr substring) and flag for human review.

4. **Integration Points**
   - `DAGEngineCallbacks.onComplete/onFail` → feed outcomes to tracker
   - `TaskAuction.bid()` → calibrated bids from agent profiles
   - `RetryPolicy` → adaptive retry limits from learning data
   - All adaptations logged forensically for transparency (Art. II)

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/agent-learning.ts` | **NEW** — OutcomeTracker, AgentProfile, AdaptationEngine |
| `tests/orchestrator/agent-learning.test.ts` | **NEW** — Outcome tracking, profiles, adaptation, decay, bid calibration |
| `docs/security/threat_model.md` | §16–§17: Learning-specific risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```

All existing 192 tests must continue passing. New tests cover: outcome recording, profile computation, success rate, duration stats, decay, retry adaptation, bid calibration, task affinity, failure pattern detection.
