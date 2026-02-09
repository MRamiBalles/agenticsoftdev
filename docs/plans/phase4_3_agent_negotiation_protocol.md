# Phase 4.3: Agent Negotiation Protocol

**Objective:** Enable agents to negotiate task ownership, resolve conflicts, and reach consensus on decisions using structured voting and auction mechanisms built on the Phase 4.2 EventBus.

## Design Decisions

1. **Negotiation Sessions (Propose → Vote → Resolve)**
   - Any agent can create a `Proposal` on a topic (e.g., "which agent handles this task?", "should we retry or abort?")
   - Eligible voters are declared at proposal creation (role-based or explicit list)
   - Voting window: configurable timeout (default 5s). Auto-resolves on expiry.
   - Immutable votes: once cast, a vote cannot be changed.

2. **Consensus Strategies**
   - **MAJORITY:** >50% of voters must agree. Ties → REJECTED.
   - **UNANIMOUS:** All voters must agree. Any dissent → REJECTED.
   - **WEIGHTED:** Votes carry role-based weight (architect: 3, strategist: 2, others: 1). Highest weighted option wins.
   - **VETO:** Any single VETO vote from `guardian` or `strategist` blocks the proposal.

3. **Task Auction**
   - Tasks can be put up for auction when multiple agents could handle them.
   - Agents submit `AuctionBid` with capability score, current load, and estimated duration.
   - Winner selected by composite score: capability (40%) + availability (30%) + speed (30%).
   - Ties broken by role priority: architect > strategist > builder > guardian > others.

4. **Integration with EventBus**
   - Proposals published to `negotiation.propose` topic
   - Votes published to `negotiation.vote` topic
   - Results published to `negotiation.result` topic
   - Auction bids on `auction.bid`, results on `auction.result`
   - All activity forensically logged via bus callbacks

## File Changes

| File | Change |
|------|--------|
| `src/orchestrator/agent-negotiation.ts` | **NEW** — NegotiationEngine, TaskAuction, consensus strategies |
| `tests/orchestrator/agent-negotiation.test.ts` | **NEW** — Proposal lifecycle, voting, auctions, conflict resolution |
| `docs/security/threat_model.md` | §14–§15: Negotiation-specific risks + architecture |

## Verification

```bash
cmd /c "npx vitest run tests/ --config vitest.node.config.ts"
```

All existing 136 tests must continue passing. New tests cover: proposal lifecycle, all 4 consensus strategies, auction bidding and scoring, timeout auto-resolution, veto mechanics, and edge cases.
