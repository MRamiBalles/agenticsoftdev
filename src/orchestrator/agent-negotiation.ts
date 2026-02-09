/**
 * Agent Negotiation Protocol: Consensus & Task Auction
 * 
 * Enables structured multi-agent decision-making:
 *   - Proposal lifecycle (propose → vote → resolve)
 *   - 4 consensus strategies: MAJORITY, UNANIMOUS, WEIGHTED, VETO
 *   - Task auctions with capability-based bidding
 *   - Immutable votes, configurable timeouts, auto-resolution
 *   - Integration with EventBus for message routing
 * 
 * Phase 4.3: Agent Negotiation Protocol
 * Compliance: constitution.md Art. I (Human Authority — all decisions logged),
 *             Art. II (No Opaque Blobs — votes are transparent)
 */

import { AgentRole } from './security-gate';
import { EventBus } from './agent-bus';

// ─── Types ───

export type ConsensusStrategy = 'MAJORITY' | 'UNANIMOUS' | 'WEIGHTED' | 'VETO';

export type ProposalStatus = 'OPEN' | 'RESOLVED' | 'REJECTED' | 'EXPIRED' | 'VETOED';

export type VoteValue = 'APPROVE' | 'REJECT' | 'ABSTAIN' | 'VETO';

/** A proposal submitted for collective decision */
export interface Proposal {
    id: string;
    /** The agent who created the proposal */
    proposer: string;
    proposerRole: AgentRole;
    /** Human-readable description */
    description: string;
    /** The options to vote on (minimum 2) */
    options: string[];
    /** Which consensus strategy to use */
    strategy: ConsensusStrategy;
    /** Eligible voter IDs (empty = all agents can vote) */
    eligibleVoters: string[];
    /** Required number of votes to resolve (0 = all eligible) */
    quorum: number;
    /** Timeout in ms (0 = no timeout) */
    timeoutMs: number;
    /** Current status */
    status: ProposalStatus;
    /** Timestamp of creation */
    createdAt: number;
    /** Metadata / context for the decision */
    context: Record<string, unknown>;
}

/** A single vote cast on a proposal */
export interface Vote {
    proposalId: string;
    voter: string;
    voterRole: AgentRole;
    /** The chosen option (must be one of proposal.options) OR a VoteValue for yes/no proposals */
    choice: string;
    /** Optional reasoning */
    reason?: string;
    timestamp: number;
}

/** Result of a resolved negotiation */
export interface ConsensusResult {
    proposalId: string;
    status: ProposalStatus;
    /** The winning option (undefined if rejected/expired) */
    winner?: string;
    /** Vote tally per option */
    tally: Record<string, number>;
    /** Weighted tally (for WEIGHTED strategy) */
    weightedTally?: Record<string, number>;
    /** Total votes cast */
    totalVotes: number;
    /** Who vetoed (for VETO strategy) */
    vetoedBy?: string;
    /** Resolution timestamp */
    resolvedAt: number;
}

/** A bid in a task auction */
export interface AuctionBid {
    auctionId: string;
    bidder: string;
    bidderRole: AgentRole;
    /** Self-reported capability score for the task (0-100) */
    capabilityScore: number;
    /** Current load (0-100, lower = more available) */
    currentLoad: number;
    /** Estimated duration in ms */
    estimatedDurationMs: number;
    /** Optional justification */
    justification?: string;
    timestamp: number;
}

/** Result of a task auction */
export interface AuctionResult {
    auctionId: string;
    taskId: string;
    winner: string;
    winnerRole: AgentRole;
    winnerScore: number;
    bids: AuctionBid[];
    resolvedAt: number;
}

/** A task auction session */
export interface Auction {
    id: string;
    taskId: string;
    taskType: string;
    /** Who initiated the auction */
    initiator: string;
    /** Bidding window in ms */
    biddingWindowMs: number;
    /** Current bids */
    bids: AuctionBid[];
    /** Whether the auction is still open */
    open: boolean;
    result?: AuctionResult;
    createdAt: number;
}

/** Callbacks for negotiation observability */
export interface NegotiationCallbacks {
    onProposalCreated?: (proposal: Proposal) => void;
    onVoteCast?: (vote: Vote) => void;
    onProposalResolved?: (result: ConsensusResult) => void;
    onAuctionCreated?: (auction: Auction) => void;
    onBidPlaced?: (bid: AuctionBid) => void;
    onAuctionResolved?: (result: AuctionResult) => void;
}

// ─── Role Weights for WEIGHTED strategy ───

const ROLE_WEIGHTS: Record<AgentRole, number> = {
    architect: 3,
    strategist: 2,
    builder: 1,
    guardian: 1,
    researcher: 1,
    devops: 1,
    designer: 1,
};

/** Role priority for auction tie-breaking (lower = higher priority) */
const ROLE_PRIORITY: Record<AgentRole, number> = {
    architect: 0,
    strategist: 1,
    builder: 2,
    guardian: 3,
    researcher: 4,
    devops: 5,
    designer: 6,
};

/** Roles that can cast VETO votes */
const VETO_ROLES: Set<AgentRole> = new Set(['guardian', 'strategist']);

// ─── NegotiationEngine ───

let proposalCounter = 0;

function generateProposalId(): string {
    proposalCounter++;
    return `prop_${Date.now()}_${proposalCounter}`;
}

export class NegotiationEngine {
    private proposals: Map<string, Proposal> = new Map();
    private votes: Map<string, Vote[]> = new Map();
    private results: Map<string, ConsensusResult> = new Map();
    private callbacks: NegotiationCallbacks;
    private bus?: EventBus;

    constructor(callbacks?: NegotiationCallbacks, bus?: EventBus) {
        this.callbacks = callbacks ?? {};
        this.bus = bus;
    }

    /**
     * Create a new proposal for collective decision.
     */
    public propose(
        proposer: string,
        proposerRole: AgentRole,
        description: string,
        options: string[],
        strategy: ConsensusStrategy = 'MAJORITY',
        config?: {
            eligibleVoters?: string[];
            quorum?: number;
            timeoutMs?: number;
            context?: Record<string, unknown>;
        },
    ): Proposal {
        const proposal: Proposal = {
            id: generateProposalId(),
            proposer,
            proposerRole,
            description,
            options: [...options],
            strategy,
            eligibleVoters: config?.eligibleVoters ?? [],
            quorum: config?.quorum ?? 0,
            timeoutMs: config?.timeoutMs ?? 5000,
            status: 'OPEN',
            createdAt: Date.now(),
            context: config?.context ?? {},
        };

        this.proposals.set(proposal.id, proposal);
        this.votes.set(proposal.id, []);
        this.callbacks.onProposalCreated?.(proposal);

        // Publish to bus if available
        this.bus?.publish(
            'negotiation.propose',
            proposer,
            proposerRole,
            { proposalId: proposal.id, description, options, strategy },
        );

        return proposal;
    }

    /**
     * Cast a vote on an open proposal.
     * Returns true if the vote was accepted.
     */
    public vote(
        proposalId: string,
        voter: string,
        voterRole: AgentRole,
        choice: string,
        reason?: string,
    ): { accepted: boolean; reason?: string } {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) {
            return { accepted: false, reason: 'PROPOSAL_NOT_FOUND' };
        }

        if (proposal.status !== 'OPEN') {
            return { accepted: false, reason: `PROPOSAL_${proposal.status}` };
        }

        // Check eligibility
        if (proposal.eligibleVoters.length > 0 && !proposal.eligibleVoters.includes(voter)) {
            return { accepted: false, reason: 'NOT_ELIGIBLE' };
        }

        // Check for duplicate vote
        const existingVotes = this.votes.get(proposalId) ?? [];
        if (existingVotes.some(v => v.voter === voter)) {
            return { accepted: false, reason: 'ALREADY_VOTED' };
        }

        // Check VETO permission (before choice validation since VETO is a special value)
        if (choice === 'VETO') {
            if (!VETO_ROLES.has(voterRole)) {
                return { accepted: false, reason: 'VETO_NOT_PERMITTED' };
            }
        } else if (choice !== 'ABSTAIN' && !proposal.options.includes(choice)) {
            // Validate choice against proposal options
            return { accepted: false, reason: 'INVALID_CHOICE' };
        }

        const voteRecord: Vote = {
            proposalId,
            voter,
            voterRole,
            choice,
            reason,
            timestamp: Date.now(),
        };

        existingVotes.push(voteRecord);
        this.callbacks.onVoteCast?.(voteRecord);

        // Publish to bus
        this.bus?.publish(
            'negotiation.vote',
            voter,
            voterRole,
            { proposalId, choice, reason: reason ?? '' },
        );

        // Check for immediate VETO resolution
        if (choice === 'VETO' && proposal.strategy === 'VETO') {
            this.resolveWithVeto(proposal, voter);
            return { accepted: true };
        }

        // Check if quorum reached → auto-resolve
        this.tryAutoResolve(proposal);

        return { accepted: true };
    }

    /**
     * Manually resolve a proposal (force-close).
     */
    public resolve(proposalId: string): ConsensusResult | null {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.status !== 'OPEN') return null;

        return this.computeResult(proposal);
    }

    /**
     * Check if a proposal has timed out and auto-resolve it.
     */
    public checkTimeout(proposalId: string): ConsensusResult | null {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.status !== 'OPEN') return null;

        if (proposal.timeoutMs > 0 && Date.now() - proposal.createdAt >= proposal.timeoutMs) {
            proposal.status = 'EXPIRED';
            const result = this.computeResult(proposal);
            result.status = 'EXPIRED';
            return result;
        }

        return null;
    }

    /**
     * Get a proposal by ID.
     */
    public getProposal(proposalId: string): Proposal | undefined {
        return this.proposals.get(proposalId);
    }

    /**
     * Get votes for a proposal.
     */
    public getVotes(proposalId: string): ReadonlyArray<Vote> {
        return this.votes.get(proposalId) ?? [];
    }

    /**
     * Get the result of a resolved proposal.
     */
    public getResult(proposalId: string): ConsensusResult | undefined {
        return this.results.get(proposalId);
    }

    /**
     * Get all open proposals.
     */
    public getOpenProposals(): Proposal[] {
        return Array.from(this.proposals.values()).filter(p => p.status === 'OPEN');
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.proposals.clear();
        this.votes.clear();
        this.results.clear();
    }

    // ─── Private: Resolution Logic ───

    private tryAutoResolve(proposal: Proposal): void {
        const votes = this.votes.get(proposal.id) ?? [];
        const quorum = proposal.quorum > 0 ? proposal.quorum : proposal.eligibleVoters.length;

        // If quorum is 0 (open to all), don't auto-resolve on count alone
        if (quorum <= 0) return;

        const nonAbstain = votes.filter(v => v.choice !== 'ABSTAIN');
        if (nonAbstain.length >= quorum) {
            this.computeResult(proposal);
        }
    }

    private resolveWithVeto(proposal: Proposal, vetoer: string): void {
        proposal.status = 'VETOED';
        const votes = this.votes.get(proposal.id) ?? [];

        const tally: Record<string, number> = {};
        for (const opt of proposal.options) tally[opt] = 0;
        for (const v of votes) {
            if (v.choice in tally) tally[v.choice]++;
        }

        const result: ConsensusResult = {
            proposalId: proposal.id,
            status: 'VETOED',
            tally,
            totalVotes: votes.length,
            vetoedBy: vetoer,
            resolvedAt: Date.now(),
        };

        this.results.set(proposal.id, result);
        this.callbacks.onProposalResolved?.(result);

        this.bus?.publish(
            'negotiation.result',
            'system',
            'strategist',
            { proposalId: proposal.id, status: 'VETOED', vetoedBy: vetoer },
        );
    }

    private computeResult(proposal: Proposal): ConsensusResult {
        const votes = this.votes.get(proposal.id) ?? [];

        // Build tally
        const tally: Record<string, number> = {};
        const weightedTally: Record<string, number> = {};
        for (const opt of proposal.options) {
            tally[opt] = 0;
            weightedTally[opt] = 0;
        }

        for (const v of votes) {
            if (v.choice === 'ABSTAIN' || v.choice === 'VETO') continue;
            if (v.choice in tally) {
                tally[v.choice]++;
                weightedTally[v.choice] += ROLE_WEIGHTS[v.voterRole] ?? 1;
            }
        }

        let winner: string | undefined;
        let status: ProposalStatus;

        switch (proposal.strategy) {
            case 'MAJORITY':
                winner = this.resolveMajority(tally, votes.length);
                status = winner ? 'RESOLVED' : 'REJECTED';
                break;

            case 'UNANIMOUS':
                winner = this.resolveUnanimous(tally, votes.length, proposal.options);
                status = winner ? 'RESOLVED' : 'REJECTED';
                break;

            case 'WEIGHTED':
                winner = this.resolveWeighted(weightedTally);
                status = winner ? 'RESOLVED' : 'REJECTED';
                break;

            case 'VETO':
                // If we get here, no VETO was cast; resolve by majority
                winner = this.resolveMajority(tally, votes.length);
                status = winner ? 'RESOLVED' : 'REJECTED';
                break;

            default:
                status = 'REJECTED';
        }

        // Override status if proposal was already expired
        if (proposal.status === 'EXPIRED') {
            status = 'EXPIRED';
        } else {
            proposal.status = status;
        }

        const result: ConsensusResult = {
            proposalId: proposal.id,
            status,
            winner,
            tally,
            weightedTally: proposal.strategy === 'WEIGHTED' ? weightedTally : undefined,
            totalVotes: votes.length,
            resolvedAt: Date.now(),
        };

        this.results.set(proposal.id, result);
        this.callbacks.onProposalResolved?.(result);

        this.bus?.publish(
            'negotiation.result',
            'system',
            'strategist',
            { proposalId: proposal.id, status, winner: winner ?? null },
        );

        return result;
    }

    /** >50% of non-abstain votes. Ties → undefined (rejected). */
    private resolveMajority(tally: Record<string, number>, totalVotes: number): string | undefined {
        const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0 || totalVotes === 0) return undefined;

        const [topOption, topCount] = entries[0];
        // Must be strictly more than half of all cast votes (excluding abstain tallied above)
        const totalNonAbstain = Object.values(tally).reduce((s, n) => s + n, 0);
        if (totalNonAbstain === 0) return undefined;
        if (topCount > totalNonAbstain / 2) return topOption;

        return undefined; // No majority
    }

    /** All non-abstain votes must choose the same option */
    private resolveUnanimous(tally: Record<string, number>, _totalVotes: number, options: string[]): string | undefined {
        const nonZero = Object.entries(tally).filter(([, count]) => count > 0);
        if (nonZero.length === 1) return nonZero[0][0];
        return undefined;
    }

    /** Highest weighted tally wins */
    private resolveWeighted(weightedTally: Record<string, number>): string | undefined {
        const entries = Object.entries(weightedTally).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return undefined;
        if (entries[0][1] === 0) return undefined;
        // Tie check
        if (entries.length > 1 && entries[0][1] === entries[1][1]) return undefined;
        return entries[0][0];
    }
}

// ─── TaskAuction ───

let auctionCounter = 0;

function generateAuctionId(): string {
    auctionCounter++;
    return `auction_${Date.now()}_${auctionCounter}`;
}

export class TaskAuction {
    private auctions: Map<string, Auction> = new Map();
    private callbacks: NegotiationCallbacks;
    private bus?: EventBus;

    constructor(callbacks?: NegotiationCallbacks, bus?: EventBus) {
        this.callbacks = callbacks ?? {};
        this.bus = bus;
    }

    /**
     * Create a new task auction.
     */
    public create(
        taskId: string,
        taskType: string,
        initiator: string,
        biddingWindowMs: number = 3000,
    ): Auction {
        const auction: Auction = {
            id: generateAuctionId(),
            taskId,
            taskType,
            initiator,
            biddingWindowMs,
            bids: [],
            open: true,
            createdAt: Date.now(),
        };

        this.auctions.set(auction.id, auction);
        this.callbacks.onAuctionCreated?.(auction);

        this.bus?.publish(
            'auction.created',
            initiator,
            'architect',
            { auctionId: auction.id, taskId, taskType },
        );

        return auction;
    }

    /**
     * Submit a bid for an open auction.
     */
    public bid(
        auctionId: string,
        bidder: string,
        bidderRole: AgentRole,
        capabilityScore: number,
        currentLoad: number,
        estimatedDurationMs: number,
        justification?: string,
    ): { accepted: boolean; reason?: string } {
        const auction = this.auctions.get(auctionId);
        if (!auction) {
            return { accepted: false, reason: 'AUCTION_NOT_FOUND' };
        }
        if (!auction.open) {
            return { accepted: false, reason: 'AUCTION_CLOSED' };
        }

        // Check for duplicate bid
        if (auction.bids.some(b => b.bidder === bidder)) {
            return { accepted: false, reason: 'ALREADY_BID' };
        }

        // Validate ranges
        if (capabilityScore < 0 || capabilityScore > 100) {
            return { accepted: false, reason: 'INVALID_CAPABILITY_SCORE' };
        }
        if (currentLoad < 0 || currentLoad > 100) {
            return { accepted: false, reason: 'INVALID_LOAD' };
        }
        if (estimatedDurationMs <= 0) {
            return { accepted: false, reason: 'INVALID_DURATION' };
        }

        const bidRecord: AuctionBid = {
            auctionId,
            bidder,
            bidderRole,
            capabilityScore,
            currentLoad,
            estimatedDurationMs,
            justification,
            timestamp: Date.now(),
        };

        auction.bids.push(bidRecord);
        this.callbacks.onBidPlaced?.(bidRecord);

        this.bus?.publish(
            'auction.bid',
            bidder,
            bidderRole,
            { auctionId, bidder, capabilityScore, currentLoad, estimatedDurationMs },
        );

        return { accepted: true };
    }

    /**
     * Close an auction and select a winner.
     * Score = capability (40%) + availability (30%) + speed (30%)
     * Ties broken by role priority.
     */
    public close(auctionId: string): AuctionResult | null {
        const auction = this.auctions.get(auctionId);
        if (!auction || !auction.open) return null;

        auction.open = false;

        if (auction.bids.length === 0) return null;

        // Score each bid
        const scored = auction.bids.map(bid => ({
            bid,
            score: this.scoreBid(bid, auction.bids),
        }));

        // Sort by score descending, then by role priority ascending (tie-break)
        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (ROLE_PRIORITY[a.bid.bidderRole] ?? 99) - (ROLE_PRIORITY[b.bid.bidderRole] ?? 99);
        });

        const winner = scored[0];

        const result: AuctionResult = {
            auctionId: auction.id,
            taskId: auction.taskId,
            winner: winner.bid.bidder,
            winnerRole: winner.bid.bidderRole,
            winnerScore: winner.score,
            bids: auction.bids,
            resolvedAt: Date.now(),
        };

        auction.result = result;
        this.callbacks.onAuctionResolved?.(result);

        this.bus?.publish(
            'auction.result',
            'system',
            'architect',
            { auctionId: auction.id, winner: winner.bid.bidder, score: winner.score },
        );

        return result;
    }

    /**
     * Get an auction by ID.
     */
    public getAuction(auctionId: string): Auction | undefined {
        return this.auctions.get(auctionId);
    }

    /**
     * Get all open auctions.
     */
    public getOpenAuctions(): Auction[] {
        return Array.from(this.auctions.values()).filter(a => a.open);
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.auctions.clear();
    }

    // ─── Private: Scoring ───

    /**
     * Composite score: capability (40%) + availability (30%) + speed (30%)
     * Availability = 100 - currentLoad
     * Speed = normalized against max estimated duration in this auction
     */
    private scoreBid(bid: AuctionBid, allBids: AuctionBid[]): number {
        const capability = bid.capabilityScore; // 0-100

        const availability = 100 - bid.currentLoad; // 0-100

        // Speed: normalize. Fastest = 100, slowest = 0
        const maxDuration = Math.max(...allBids.map(b => b.estimatedDurationMs));
        const speed = maxDuration > 0
            ? ((maxDuration - bid.estimatedDurationMs) / maxDuration) * 100
            : 100;

        return (capability * 0.4) + (availability * 0.3) + (speed * 0.3);
    }
}
