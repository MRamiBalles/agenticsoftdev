/**
 * Agent Negotiation Protocol Tests
 * 
 * Validates: proposal lifecycle, all 4 consensus strategies,
 * task auction bidding/scoring, timeout, veto mechanics, RBAC,
 * immutable votes, edge cases.
 * 
 * Phase 4.3: Agent Negotiation Protocol
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    NegotiationEngine,
    TaskAuction,
    Proposal,
    Vote,
    ConsensusResult,
    AuctionResult,
} from '../../src/orchestrator/agent-negotiation';
import { EventBus } from '../../src/orchestrator/agent-bus';

// ─── NegotiationEngine: Proposal Lifecycle ───

describe('NegotiationEngine - Proposal Lifecycle', () => {
    let engine: NegotiationEngine;

    beforeEach(() => {
        engine = new NegotiationEngine();
    });

    it('should create a proposal with OPEN status', () => {
        const proposal = engine.propose('arch-1', 'architect', 'Choose DB', ['PostgreSQL', 'MySQL'], 'MAJORITY');

        expect(proposal.status).toBe('OPEN');
        expect(proposal.options).toEqual(['PostgreSQL', 'MySQL']);
        expect(proposal.strategy).toBe('MAJORITY');
        expect(proposal.proposer).toBe('arch-1');
    });

    it('should list open proposals', () => {
        engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.propose('a', 'architect', 'Q2', ['C', 'D'], 'MAJORITY');

        expect(engine.getOpenProposals()).toHaveLength(2);
    });

    it('should retrieve a proposal by ID', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        expect(engine.getProposal(p.id)).toBeDefined();
        expect(engine.getProposal(p.id)!.description).toBe('Q1');
    });

    it('should accept valid votes', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        const result = engine.vote(p.id, 'voter-1', 'builder', 'A');
        expect(result.accepted).toBe(true);
    });

    it('should reject votes on non-existent proposals', () => {
        const result = engine.vote('fake-id', 'voter', 'builder', 'A');
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('PROPOSAL_NOT_FOUND');
    });

    it('should reject duplicate votes from same voter', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'voter-1', 'builder', 'A');
        const result = engine.vote(p.id, 'voter-1', 'builder', 'B');
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('ALREADY_VOTED');
    });

    it('should reject invalid choices', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        const result = engine.vote(p.id, 'voter-1', 'builder', 'C');
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('INVALID_CHOICE');
    });

    it('should accept ABSTAIN as a valid choice', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        const result = engine.vote(p.id, 'voter-1', 'builder', 'ABSTAIN');
        expect(result.accepted).toBe(true);
    });

    it('should reject votes from ineligible voters', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY', {
            eligibleVoters: ['voter-1', 'voter-2'],
        });
        const result = engine.vote(p.id, 'outsider', 'builder', 'A');
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('NOT_ELIGIBLE');
    });

    it('should track votes per proposal', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        engine.vote(p.id, 'v2', 'guardian', 'B');

        const votes = engine.getVotes(p.id);
        expect(votes).toHaveLength(2);
    });

    it('should manually resolve a proposal', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        engine.vote(p.id, 'v2', 'guardian', 'A');
        engine.vote(p.id, 'v3', 'architect', 'B');

        const result = engine.resolve(p.id);
        expect(result).not.toBeNull();
        expect(result!.winner).toBe('A');
        expect(result!.status).toBe('RESOLVED');
    });

    it('should reject votes on already resolved proposals', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        engine.resolve(p.id);

        const result = engine.vote(p.id, 'v2', 'guardian', 'B');
        expect(result.accepted).toBe(false);
        expect(result.reason).toContain('PROPOSAL_');
    });

    it('should store and retrieve results', () => {
        const p = engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        engine.resolve(p.id);

        const result = engine.getResult(p.id);
        expect(result).toBeDefined();
        expect(result!.proposalId).toBe(p.id);
    });

    it('should reset all state', () => {
        engine.propose('a', 'architect', 'Q1', ['A', 'B'], 'MAJORITY');
        engine.reset();
        expect(engine.getOpenProposals()).toHaveLength(0);
    });
});

// ─── NegotiationEngine: MAJORITY Strategy ───

describe('NegotiationEngine - MAJORITY Strategy', () => {
    let engine: NegotiationEngine;

    beforeEach(() => {
        engine = new NegotiationEngine();
    });

    it('should resolve when one option has >50% votes', () => {
        const p = engine.propose('a', 'architect', 'DB', ['Postgres', 'MySQL'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'Postgres');
        engine.vote(p.id, 'v2', 'guardian', 'Postgres');
        engine.vote(p.id, 'v3', 'designer', 'MySQL');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBe('Postgres');
        expect(result.tally['Postgres']).toBe(2);
        expect(result.tally['MySQL']).toBe(1);
    });

    it('should reject on exact tie', () => {
        const p = engine.propose('a', 'architect', 'DB', ['Postgres', 'MySQL'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'Postgres');
        engine.vote(p.id, 'v2', 'guardian', 'MySQL');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBeUndefined();
        expect(result.status).toBe('REJECTED');
    });

    it('should resolve with no votes as REJECTED', () => {
        const p = engine.propose('a', 'architect', 'DB', ['Postgres', 'MySQL'], 'MAJORITY');
        const result = engine.resolve(p.id)!;
        expect(result.status).toBe('REJECTED');
    });

    it('should ignore ABSTAIN votes in tally', () => {
        const p = engine.propose('a', 'architect', 'DB', ['Postgres', 'MySQL'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'Postgres');
        engine.vote(p.id, 'v2', 'guardian', 'ABSTAIN');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBe('Postgres'); // 1 out of 1 non-abstain = 100%
    });
});

// ─── NegotiationEngine: UNANIMOUS Strategy ───

describe('NegotiationEngine - UNANIMOUS Strategy', () => {
    let engine: NegotiationEngine;

    beforeEach(() => {
        engine = new NegotiationEngine();
    });

    it('should resolve when all votes agree', () => {
        const p = engine.propose('a', 'architect', 'Framework', ['React', 'Vue'], 'UNANIMOUS');
        engine.vote(p.id, 'v1', 'builder', 'React');
        engine.vote(p.id, 'v2', 'designer', 'React');
        engine.vote(p.id, 'v3', 'guardian', 'React');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBe('React');
        expect(result.status).toBe('RESOLVED');
    });

    it('should reject when votes disagree', () => {
        const p = engine.propose('a', 'architect', 'Framework', ['React', 'Vue'], 'UNANIMOUS');
        engine.vote(p.id, 'v1', 'builder', 'React');
        engine.vote(p.id, 'v2', 'designer', 'Vue');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBeUndefined();
        expect(result.status).toBe('REJECTED');
    });
});

// ─── NegotiationEngine: WEIGHTED Strategy ───

describe('NegotiationEngine - WEIGHTED Strategy', () => {
    let engine: NegotiationEngine;

    beforeEach(() => {
        engine = new NegotiationEngine();
    });

    it('should give architect 3x weight', () => {
        const p = engine.propose('a', 'architect', 'DB', ['Postgres', 'MySQL'], 'WEIGHTED');
        // architect (weight 3) votes Postgres
        engine.vote(p.id, 'arch', 'architect', 'Postgres');
        // 2 builders (weight 1 each) vote MySQL
        engine.vote(p.id, 'b1', 'builder', 'MySQL');
        engine.vote(p.id, 'b2', 'builder', 'MySQL');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBe('Postgres'); // 3 > 2
        expect(result.weightedTally!['Postgres']).toBe(3);
        expect(result.weightedTally!['MySQL']).toBe(2);
    });

    it('should reject on weighted tie', () => {
        const p = engine.propose('a', 'architect', 'DB', ['Postgres', 'MySQL'], 'WEIGHTED');
        // strategist (weight 2) votes Postgres
        engine.vote(p.id, 'strat', 'strategist', 'Postgres');
        // 2 builders (weight 1 each) vote MySQL
        engine.vote(p.id, 'b1', 'builder', 'MySQL');
        engine.vote(p.id, 'b2', 'builder', 'MySQL');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBeUndefined(); // 2 vs 2 = tie
        expect(result.status).toBe('REJECTED');
    });

    it('should include weightedTally in result', () => {
        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'WEIGHTED');
        engine.vote(p.id, 'v1', 'architect', 'A');

        const result = engine.resolve(p.id)!;
        expect(result.weightedTally).toBeDefined();
        expect(result.weightedTally!['A']).toBe(3);
    });
});

// ─── NegotiationEngine: VETO Strategy ───

describe('NegotiationEngine - VETO Strategy', () => {
    let engine: NegotiationEngine;

    beforeEach(() => {
        engine = new NegotiationEngine();
    });

    it('should immediately resolve on VETO from guardian', () => {
        const p = engine.propose('a', 'architect', 'Deploy?', ['yes', 'no'], 'VETO');
        engine.vote(p.id, 'b1', 'builder', 'yes');

        const voteResult = engine.vote(p.id, 'g1', 'guardian', 'VETO', 'Security risk');
        expect(voteResult.accepted).toBe(true);

        const proposal = engine.getProposal(p.id)!;
        expect(proposal.status).toBe('VETOED');

        const result = engine.getResult(p.id)!;
        expect(result.status).toBe('VETOED');
        expect(result.vetoedBy).toBe('g1');
    });

    it('should immediately resolve on VETO from strategist', () => {
        const p = engine.propose('a', 'architect', 'Deploy?', ['yes', 'no'], 'VETO');
        engine.vote(p.id, 's1', 'strategist', 'VETO', 'Not aligned with plan');

        const result = engine.getResult(p.id)!;
        expect(result.status).toBe('VETOED');
        expect(result.vetoedBy).toBe('s1');
    });

    it('should reject VETO from non-authorized role (builder)', () => {
        const p = engine.propose('a', 'architect', 'Deploy?', ['yes', 'no'], 'VETO');
        const voteResult = engine.vote(p.id, 'b1', 'builder', 'VETO');
        expect(voteResult.accepted).toBe(false);
        expect(voteResult.reason).toBe('VETO_NOT_PERMITTED');
    });

    it('should resolve by majority if no veto is cast', () => {
        const p = engine.propose('a', 'architect', 'Deploy?', ['yes', 'no'], 'VETO');
        engine.vote(p.id, 'b1', 'builder', 'yes');
        engine.vote(p.id, 'b2', 'builder', 'yes');
        engine.vote(p.id, 'g1', 'guardian', 'no');

        const result = engine.resolve(p.id)!;
        expect(result.winner).toBe('yes');
        expect(result.status).toBe('RESOLVED');
    });
});

// ─── NegotiationEngine: Timeout ───

describe('NegotiationEngine - Timeout', () => {
    it('should expire proposal after timeout', () => {
        const engine = new NegotiationEngine();
        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY', {
            timeoutMs: 1, // 1ms timeout
        });

        // Tiny delay to ensure timeout
        const start = Date.now();
        while (Date.now() - start < 5) { /* spin */ }

        const result = engine.checkTimeout(p.id);
        expect(result).not.toBeNull();
        expect(result!.status).toBe('EXPIRED');
    });

    it('should not expire proposal before timeout', () => {
        const engine = new NegotiationEngine();
        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY', {
            timeoutMs: 60000,
        });

        const result = engine.checkTimeout(p.id);
        expect(result).toBeNull();
    });
});

// ─── NegotiationEngine: Callbacks ───

describe('NegotiationEngine - Callbacks', () => {
    it('should fire onProposalCreated', () => {
        const created: Proposal[] = [];
        const engine = new NegotiationEngine({ onProposalCreated: (p) => created.push(p) });

        engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY');
        expect(created).toHaveLength(1);
    });

    it('should fire onVoteCast', () => {
        const cast: Vote[] = [];
        const engine = new NegotiationEngine({ onVoteCast: (v) => cast.push(v) });

        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        expect(cast).toHaveLength(1);
        expect(cast[0].choice).toBe('A');
    });

    it('should fire onProposalResolved', () => {
        const resolved: ConsensusResult[] = [];
        const engine = new NegotiationEngine({ onProposalResolved: (r) => resolved.push(r) });

        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        engine.resolve(p.id);

        expect(resolved).toHaveLength(1);
    });
});

// ─── NegotiationEngine: EventBus Integration ───

describe('NegotiationEngine - EventBus Integration', () => {
    it('should publish proposal to bus', () => {
        const bus = new EventBus({ enforceRBAC: false });
        const engine = new NegotiationEngine({}, bus);

        engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY');

        const msgs = bus.getMessages('negotiation.propose');
        expect(msgs).toHaveLength(1);
    });

    it('should publish votes to bus', () => {
        const bus = new EventBus({ enforceRBAC: false });
        const engine = new NegotiationEngine({}, bus);

        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');

        const msgs = bus.getMessages('negotiation.vote');
        expect(msgs).toHaveLength(1);
    });

    it('should publish results to bus', () => {
        const bus = new EventBus({ enforceRBAC: false });
        const engine = new NegotiationEngine({}, bus);

        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY');
        engine.vote(p.id, 'v1', 'builder', 'A');
        engine.resolve(p.id);

        const msgs = bus.getMessages('negotiation.result');
        expect(msgs).toHaveLength(1);
    });
});

// ─── TaskAuction: Core ───

describe('TaskAuction - Core', () => {
    let auction: TaskAuction;

    beforeEach(() => {
        auction = new TaskAuction();
    });

    it('should create an open auction', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        expect(a.open).toBe(true);
        expect(a.taskId).toBe('task-1');
        expect(a.bids).toHaveLength(0);
    });

    it('should accept valid bids', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        const result = auction.bid(a.id, 'builder-1', 'builder', 80, 20, 5000);
        expect(result.accepted).toBe(true);
    });

    it('should reject duplicate bids', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        auction.bid(a.id, 'builder-1', 'builder', 80, 20, 5000);
        const result = auction.bid(a.id, 'builder-1', 'builder', 90, 10, 3000);
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('ALREADY_BID');
    });

    it('should reject bids on non-existent auction', () => {
        const result = auction.bid('fake', 'builder-1', 'builder', 80, 20, 5000);
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('AUCTION_NOT_FOUND');
    });

    it('should reject bids on closed auction', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        auction.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        auction.close(a.id);

        const result = auction.bid(a.id, 'b2', 'builder', 90, 10, 3000);
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('AUCTION_CLOSED');
    });

    it('should reject invalid capability score', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        const result = auction.bid(a.id, 'b1', 'builder', 150, 20, 5000);
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('INVALID_CAPABILITY_SCORE');
    });

    it('should reject invalid load', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        const result = auction.bid(a.id, 'b1', 'builder', 80, -1, 5000);
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('INVALID_LOAD');
    });

    it('should reject invalid duration', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        const result = auction.bid(a.id, 'b1', 'builder', 80, 20, 0);
        expect(result.accepted).toBe(false);
        expect(result.reason).toBe('INVALID_DURATION');
    });

    it('should retrieve auction by ID', () => {
        const a = auction.create('task-1', 'CODE', 'architect');
        expect(auction.getAuction(a.id)).toBeDefined();
    });

    it('should list open auctions', () => {
        auction.create('task-1', 'CODE', 'architect');
        auction.create('task-2', 'AUDIT', 'architect');
        expect(auction.getOpenAuctions()).toHaveLength(2);
    });
});

// ─── TaskAuction: Scoring & Winner Selection ───

describe('TaskAuction - Scoring & Winner Selection', () => {
    let auctionEngine: TaskAuction;

    beforeEach(() => {
        auctionEngine = new TaskAuction();
    });

    it('should select highest scoring bidder', () => {
        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        // Builder: cap=80, load=20, dur=5000 → score high
        auctionEngine.bid(a.id, 'builder-good', 'builder', 80, 20, 5000);
        // Builder: cap=40, load=80, dur=10000 → score low
        auctionEngine.bid(a.id, 'builder-bad', 'builder', 40, 80, 10000);

        const result = auctionEngine.close(a.id)!;
        expect(result.winner).toBe('builder-good');
    });

    it('should break ties by role priority', () => {
        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        // Both have identical scores but different roles
        auctionEngine.bid(a.id, 'builder-1', 'builder', 80, 20, 5000);
        auctionEngine.bid(a.id, 'arch-1', 'architect', 80, 20, 5000);

        const result = auctionEngine.close(a.id)!;
        expect(result.winner).toBe('arch-1'); // architect has higher priority
    });

    it('should return null for empty auction', () => {
        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        const result = auctionEngine.close(a.id);
        expect(result).toBeNull();
    });

    it('should include all bids in result', () => {
        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        auctionEngine.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        auctionEngine.bid(a.id, 'b2', 'devops', 70, 30, 6000);

        const result = auctionEngine.close(a.id)!;
        expect(result.bids).toHaveLength(2);
        expect(result.winnerScore).toBeGreaterThan(0);
    });

    it('should close the auction after resolving', () => {
        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        auctionEngine.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        auctionEngine.close(a.id);

        expect(auctionEngine.getAuction(a.id)!.open).toBe(false);
    });

    it('should return null when closing already-closed auction', () => {
        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        auctionEngine.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        auctionEngine.close(a.id);

        const result = auctionEngine.close(a.id);
        expect(result).toBeNull();
    });
});

// ─── TaskAuction: Callbacks ───

describe('TaskAuction - Callbacks', () => {
    it('should fire onAuctionCreated', () => {
        const created: string[] = [];
        const auctionEngine = new TaskAuction({ onAuctionCreated: (a) => created.push(a.id) });

        auctionEngine.create('task-1', 'CODE', 'architect');
        expect(created).toHaveLength(1);
    });

    it('should fire onBidPlaced', () => {
        const bids: string[] = [];
        const auctionEngine = new TaskAuction({ onBidPlaced: (b) => bids.push(b.bidder) });

        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        auctionEngine.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        expect(bids).toEqual(['b1']);
    });

    it('should fire onAuctionResolved', () => {
        const results: AuctionResult[] = [];
        const auctionEngine = new TaskAuction({ onAuctionResolved: (r) => results.push(r) });

        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        auctionEngine.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        auctionEngine.close(a.id);

        expect(results).toHaveLength(1);
        expect(results[0].winner).toBe('b1');
    });
});

// ─── TaskAuction: EventBus Integration ───

describe('TaskAuction - EventBus Integration', () => {
    it('should publish auction events to bus', () => {
        const bus = new EventBus({ enforceRBAC: false });
        const auctionEngine = new TaskAuction({}, bus);

        const a = auctionEngine.create('task-1', 'CODE', 'architect');
        auctionEngine.bid(a.id, 'b1', 'builder', 80, 20, 5000);
        auctionEngine.close(a.id);

        expect(bus.getMessages('auction.created')).toHaveLength(1);
        expect(bus.getMessages('auction.bid')).toHaveLength(1);
        expect(bus.getMessages('auction.result')).toHaveLength(1);
    });
});

// ─── NegotiationEngine: Quorum Auto-Resolve ───

describe('NegotiationEngine - Quorum Auto-Resolve', () => {
    it('should auto-resolve when quorum is met', () => {
        const resolved: ConsensusResult[] = [];
        const engine = new NegotiationEngine({ onProposalResolved: (r) => resolved.push(r) });

        const p = engine.propose('a', 'architect', 'Q', ['A', 'B'], 'MAJORITY', {
            eligibleVoters: ['v1', 'v2', 'v3'],
            quorum: 2,
        });

        engine.vote(p.id, 'v1', 'builder', 'A');
        expect(resolved).toHaveLength(0); // not yet

        engine.vote(p.id, 'v2', 'guardian', 'A');
        expect(resolved).toHaveLength(1); // quorum met
        expect(resolved[0].winner).toBe('A');
    });
});
