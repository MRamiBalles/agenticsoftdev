# Phase 4.7: Agent Self-Healing

**Objective:** Enable automatic error recovery by detecting common failure patterns, applying corrective actions, and escalating to humans only when self-repair fails or confidence is too low.

## Design Decisions

1. **Failure Detection**
   - Classify failures into categories: `OOM`, `TIMEOUT`, `DEPENDENCY_FAILURE`, `CRASH`, `PERMISSION_DENIED`, `NETWORK_ERROR`, `UNKNOWN`.
   - Pattern matching on stderr, exit codes, and duration anomalies.
   - Confidence score (0–1) for each classification based on signal strength.

2. **Healing Actions**
   - **RESTART:** Re-dispatch the same task (simple retry with reset).
   - **REROUTE:** Dispatch to a different worker or agent.
   - **SCALE_DOWN:** Reduce payload size or complexity for OOM.
   - **RETRY_WITH_BACKOFF:** Exponential backoff for transient failures.
   - **SKIP_DEPENDENCY:** Mark failed dependency as non-blocking if optional.
   - Each action has a max attempts limit and cooldown period.

3. **Healing Strategy**
   - Maps failure categories → ordered list of healing actions.
   - Actions tried in priority order. Next action tried if previous fails.
   - Configurable per task type.

4. **Escalation Policy**
   - Escalate to human when: all healing actions exhausted, confidence < 0.5, or critical task type.
   - Escalation levels: WARN (log only), ALERT (notify), BLOCK (halt execution).
   - Max healing attempts per task before forced escalation (default: 3).

5. **Healing Records**
   - Every healing attempt logged: failure category, action taken, result, duration.
   - Feeds back into AdaptationEngine for learning from healing success/failure.

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/agent-self-healing.ts` | **NEW** — FailureDetector, HealingEngine, EscalationManager |
| `tests/orchestrator/agent-self-healing.test.ts` | **NEW** — Detection, healing, escalation, records |
| `docs/security/threat_model.md` | §22–§23: Self-healing risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```
