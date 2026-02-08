
# SDD Pipeline Specification (v3.0)

## Objective
Erradicate "Vibe Coding" by enforcing a strict hierarchy of intent:
**Prompt -> Specification -> Architecture Plan -> Atomic Tasks -> Implementation**

## Tools
- `scripts/sdd/specify.ts`: Interactive prompt to capture "The What & Why".
- `scripts/sdd/plan.ts`: Architect agent to define "The How" (APIs, Data, Files).
- `scripts/sdd/taskify.ts`: Deconstructor to create "The Steps" (`task.md`).

## Workflow Example
1. User runs `npm run specify "Feature XYZ"`.
2. Agent probes user for missing details, creates `docs/specs/feature_xyz.md`.
3. User reviews and signs off (Article I - Constitution).
4. User runs `npm run plan feature_xyz`.
5. Agent generates `docs/plans/feature_xyz.md`, validated against `constitution.md`.
6. Agent runs `taskify` to populate the project's main `task.md`.
7. Implementation begins only after this gate.

## Governance Integration
- Every SDD step is logged to the `FlightRecorder`.
- Plans must pass the `check_constitution.ts` gate.
