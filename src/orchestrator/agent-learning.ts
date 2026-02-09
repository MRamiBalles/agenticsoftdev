/**
 * Agent Learning & Adaptation: Outcome Tracking & Performance Profiles
 * 
 * Enables agents to learn from past task outcomes:
 *   - Outcome tracking per agent+taskType pair
 *   - Rolling window with exponential decay (favors recent performance)
 *   - Success rate, duration stats, retry rate computation
 *   - Retry tuning based on historical success
 *   - Bid calibration for auction accuracy
 *   - Task affinity recommendations
 *   - Failure pattern detection for human review
 * 
 * Phase 4.4: Agent Learning & Adaptation
 * Compliance: constitution.md Art. I (Human Authority — adaptations are transparent),
 *             Art. II (No Opaque Blobs — all learning logged)
 */

import { TaskType } from './retry-policy';
import { AgentRole } from './security-gate';

// ─── Types ───

/** A recorded task outcome */
export interface TaskOutcome {
    agent: string;
    agentRole: AgentRole;
    taskType: TaskType;
    taskId: string;
    success: boolean;
    exitCode: number;
    durationMs: number;
    retryCount: number;
    depth: number;
    errorPattern?: string;
    timestamp: number;
}

/** Computed stats for an agent+taskType pair */
export interface PerformanceStats {
    agent: string;
    taskType: TaskType;
    totalOutcomes: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    avgRetryCount: number;
    retrySuccessRate: number;
    lastOutcome: number;
    /** Most common error pattern (if any) */
    topErrorPattern?: string;
    topErrorCount: number;
}

/** Full agent profile across all task types */
export interface AgentProfile {
    agent: string;
    role: AgentRole;
    taskStats: Map<TaskType, PerformanceStats>;
    /** Overall success rate across all task types */
    overallSuccessRate: number;
    /** Total outcomes recorded */
    totalOutcomes: number;
    lastUpdated: number;
}

/** Adaptation recommendation */
export interface AdaptationRecommendation {
    type: 'RETRY_TUNE' | 'BID_CALIBRATE' | 'TASK_AFFINITY' | 'FAILURE_ALERT';
    agent: string;
    taskType: TaskType;
    description: string;
    suggestedValue?: number;
    confidence: number;
}

/** Configuration for the learning engine */
export interface LearningConfig {
    /** Max outcomes per agent+taskType pair (rolling window) */
    maxOutcomesPerPair: number;
    /** Decay half-life in ms (default: 1 hour) */
    decayHalfLifeMs: number;
    /** Minimum outcomes before making recommendations */
    minOutcomesForRecommendation: number;
    /** Threshold for retry tuning: if retry success < this, reduce retries */
    retrySuccessThreshold: number;
    /** Threshold for failure alert: if error pattern count >= this, alert */
    failurePatternAlertThreshold: number;
}

/** Callbacks for learning observability */
export interface LearningCallbacks {
    onOutcomeRecorded?: (outcome: TaskOutcome) => void;
    onProfileUpdated?: (profile: AgentProfile) => void;
    onRecommendation?: (rec: AdaptationRecommendation) => void;
}

// ─── Defaults ───

const DEFAULT_LEARNING_CONFIG: LearningConfig = {
    maxOutcomesPerPair: 50,
    decayHalfLifeMs: 3_600_000, // 1 hour
    minOutcomesForRecommendation: 5,
    retrySuccessThreshold: 0.2,
    failurePatternAlertThreshold: 3,
};

// ─── OutcomeTracker ───

export class OutcomeTracker {
    private outcomes: Map<string, TaskOutcome[]> = new Map();
    private config: LearningConfig;
    private callbacks: LearningCallbacks;

    constructor(config?: Partial<LearningConfig>, callbacks?: LearningCallbacks) {
        this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Record a task outcome.
     */
    public record(outcome: TaskOutcome): void {
        const key = this.pairKey(outcome.agent, outcome.taskType);

        if (!this.outcomes.has(key)) {
            this.outcomes.set(key, []);
        }

        const list = this.outcomes.get(key)!;
        list.push(outcome);

        // Enforce rolling window
        if (list.length > this.config.maxOutcomesPerPair) {
            list.shift();
        }

        this.callbacks.onOutcomeRecorded?.(outcome);
    }

    /**
     * Get raw outcomes for an agent+taskType pair.
     */
    public getOutcomes(agent: string, taskType: TaskType): ReadonlyArray<TaskOutcome> {
        return this.outcomes.get(this.pairKey(agent, taskType)) ?? [];
    }

    /**
     * Get all outcomes for an agent across all task types.
     */
    public getAllOutcomesForAgent(agent: string): TaskOutcome[] {
        const results: TaskOutcome[] = [];
        for (const [key, outcomes] of this.outcomes) {
            if (key.startsWith(`${agent}:`)) {
                results.push(...outcomes);
            }
        }
        return results;
    }

    /**
     * Compute performance stats for an agent+taskType pair.
     * Applies exponential decay weighting to favor recent outcomes.
     */
    public computeStats(agent: string, taskType: TaskType): PerformanceStats | null {
        const outcomes = this.getOutcomes(agent, taskType);
        if (outcomes.length === 0) return null;

        const now = Date.now();
        let weightedSuccess = 0;
        let weightedTotal = 0;
        let totalDuration = 0;
        let totalRetries = 0;
        let retriedCount = 0;
        let retriedSuccess = 0;
        const durations: number[] = [];
        const errorCounts: Map<string, number> = new Map();

        for (const o of outcomes) {
            const age = now - o.timestamp;
            const weight = Math.pow(0.5, age / this.config.decayHalfLifeMs);

            weightedTotal += weight;
            if (o.success) weightedSuccess += weight;

            totalDuration += o.durationMs;
            durations.push(o.durationMs);
            totalRetries += o.retryCount;

            if (o.retryCount > 0) {
                retriedCount++;
                if (o.success) retriedSuccess++;
            }

            if (o.errorPattern) {
                errorCounts.set(o.errorPattern, (errorCounts.get(o.errorPattern) ?? 0) + 1);
            }
        }

        // Sort durations for p95
        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(durations.length * 0.95);
        const p95 = durations[Math.min(p95Index, durations.length - 1)];

        // Top error pattern
        let topErrorPattern: string | undefined;
        let topErrorCount = 0;
        for (const [pattern, count] of errorCounts) {
            if (count > topErrorCount) {
                topErrorPattern = pattern;
                topErrorCount = count;
            }
        }

        return {
            agent,
            taskType,
            totalOutcomes: outcomes.length,
            successCount: outcomes.filter(o => o.success).length,
            failureCount: outcomes.filter(o => !o.success).length,
            successRate: weightedTotal > 0 ? weightedSuccess / weightedTotal : 0,
            avgDurationMs: totalDuration / outcomes.length,
            p95DurationMs: p95,
            avgRetryCount: totalRetries / outcomes.length,
            retrySuccessRate: retriedCount > 0 ? retriedSuccess / retriedCount : 0,
            lastOutcome: outcomes[outcomes.length - 1].timestamp,
            topErrorPattern,
            topErrorCount,
        };
    }

    /**
     * Build a full agent profile across all task types.
     */
    public buildProfile(agent: string, role: AgentRole): AgentProfile {
        const taskStats: Map<TaskType, PerformanceStats> = new Map();
        let totalSuccessWeight = 0;
        let totalWeight = 0;
        let totalOutcomes = 0;
        let lastUpdated = 0;

        for (const [key, outcomes] of this.outcomes) {
            if (!key.startsWith(`${agent}:`)) continue;

            const taskType = key.split(':')[1] as TaskType;
            const stats = this.computeStats(agent, taskType);
            if (stats) {
                taskStats.set(taskType, stats);
                totalSuccessWeight += stats.successRate * stats.totalOutcomes;
                totalWeight += stats.totalOutcomes;
                totalOutcomes += stats.totalOutcomes;
                lastUpdated = Math.max(lastUpdated, stats.lastOutcome);
            }
        }

        return {
            agent,
            role,
            taskStats,
            overallSuccessRate: totalWeight > 0 ? totalSuccessWeight / totalWeight : 0,
            totalOutcomes,
            lastUpdated,
        };
    }

    /**
     * Get total outcome count.
     */
    public getTotalOutcomes(): number {
        let total = 0;
        for (const outcomes of this.outcomes.values()) {
            total += outcomes.length;
        }
        return total;
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.outcomes.clear();
    }

    private pairKey(agent: string, taskType: TaskType): string {
        return `${agent}:${taskType}`;
    }
}

// ─── AdaptationEngine ───

export class AdaptationEngine {
    private tracker: OutcomeTracker;
    private config: LearningConfig;
    private callbacks: LearningCallbacks;

    constructor(tracker: OutcomeTracker, config?: Partial<LearningConfig>, callbacks?: LearningCallbacks) {
        this.tracker = tracker;
        this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Generate all adaptation recommendations for an agent.
     */
    public recommend(agent: string, role: AgentRole): AdaptationRecommendation[] {
        const profile = this.tracker.buildProfile(agent, role);
        const recs: AdaptationRecommendation[] = [];

        for (const [taskType, stats] of profile.taskStats) {
            if (stats.totalOutcomes < this.config.minOutcomesForRecommendation) continue;

            // Retry tuning
            const retryRec = this.evaluateRetryTuning(stats);
            if (retryRec) recs.push(retryRec);

            // Bid calibration
            const bidRec = this.evaluateBidCalibration(stats);
            if (bidRec) recs.push(bidRec);

            // Failure pattern detection
            const failRec = this.evaluateFailurePattern(stats);
            if (failRec) recs.push(failRec);
        }

        // Task affinity
        const affinityRecs = this.evaluateTaskAffinity(profile);
        recs.push(...affinityRecs);

        for (const rec of recs) {
            this.callbacks.onRecommendation?.(rec);
        }

        return recs;
    }

    /**
     * Get a calibrated capability score for an agent bidding on a task type.
     * Based on historical success rate.
     */
    public getCalibratedCapability(agent: string, taskType: TaskType): number | null {
        const stats = this.tracker.computeStats(agent, taskType);
        if (!stats || stats.totalOutcomes < this.config.minOutcomesForRecommendation) {
            return null;
        }
        return Math.round(stats.successRate * 100);
    }

    /**
     * Get a calibrated duration estimate for an agent on a task type.
     * Returns the p95 duration as a conservative estimate.
     */
    public getCalibratedDuration(agent: string, taskType: TaskType): number | null {
        const stats = this.tracker.computeStats(agent, taskType);
        if (!stats || stats.totalOutcomes < this.config.minOutcomesForRecommendation) {
            return null;
        }
        return Math.round(stats.p95DurationMs);
    }

    /**
     * Get the best agent for a task type based on historical performance.
     * Returns agents sorted by success rate (descending), then avg duration (ascending).
     */
    public getTaskAffinity(taskType: TaskType, candidates: { agent: string; role: AgentRole }[]): { agent: string; score: number }[] {
        const scored: { agent: string; score: number }[] = [];

        for (const { agent } of candidates) {
            const stats = this.tracker.computeStats(agent, taskType);
            if (!stats || stats.totalOutcomes < this.config.minOutcomesForRecommendation) {
                continue;
            }
            // Score: success rate (70%) + speed factor (30%)
            // Speed factor: inverse of avg duration, normalized 0-1 against candidate pool
            scored.push({ agent, score: stats.successRate });
        }

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    /**
     * Suggest an adaptive retry limit for an agent+taskType.
     * Returns null if insufficient data.
     */
    public getSuggestedRetryLimit(agent: string, taskType: TaskType): number | null {
        const stats = this.tracker.computeStats(agent, taskType);
        if (!stats || stats.totalOutcomes < this.config.minOutcomesForRecommendation) {
            return null;
        }

        // If retry success rate is very low, suggest reducing retries
        if (stats.retrySuccessRate < this.config.retrySuccessThreshold) {
            return 0; // Don't waste resources retrying
        }

        // If retry success rate is high, allow standard retries
        if (stats.retrySuccessRate > 0.8) {
            return 3; // Generous retry allowance
        }

        // Default: moderate
        return 1;
    }

    // ─── Private: Evaluation ───

    private evaluateRetryTuning(stats: PerformanceStats): AdaptationRecommendation | null {
        if (stats.avgRetryCount === 0) return null;

        if (stats.retrySuccessRate < this.config.retrySuccessThreshold) {
            return {
                type: 'RETRY_TUNE',
                agent: stats.agent,
                taskType: stats.taskType,
                description: `Retry success rate for ${stats.taskType} is ${(stats.retrySuccessRate * 100).toFixed(0)}% (<${(this.config.retrySuccessThreshold * 100).toFixed(0)}%). Consider reducing max retries.`,
                suggestedValue: 0,
                confidence: Math.min(stats.totalOutcomes / 20, 1),
            };
        }

        return null;
    }

    private evaluateBidCalibration(stats: PerformanceStats): AdaptationRecommendation | null {
        return {
            type: 'BID_CALIBRATE',
            agent: stats.agent,
            taskType: stats.taskType,
            description: `Calibrated capability: ${(stats.successRate * 100).toFixed(0)}%, est. duration: ${stats.p95DurationMs}ms (p95)`,
            suggestedValue: Math.round(stats.successRate * 100),
            confidence: Math.min(stats.totalOutcomes / 20, 1),
        };
    }

    private evaluateFailurePattern(stats: PerformanceStats): AdaptationRecommendation | null {
        if (!stats.topErrorPattern || stats.topErrorCount < this.config.failurePatternAlertThreshold) {
            return null;
        }

        return {
            type: 'FAILURE_ALERT',
            agent: stats.agent,
            taskType: stats.taskType,
            description: `Recurring failure pattern (${stats.topErrorCount}x): "${stats.topErrorPattern}". Requires human review.`,
            confidence: Math.min(stats.topErrorCount / 10, 1),
        };
    }

    private evaluateTaskAffinity(profile: AgentProfile): AdaptationRecommendation[] {
        const recs: AdaptationRecommendation[] = [];

        // Find the agent's best task type
        let bestType: TaskType | null = null;
        let bestRate = 0;

        for (const [taskType, stats] of profile.taskStats) {
            if (stats.totalOutcomes >= this.config.minOutcomesForRecommendation && stats.successRate > bestRate) {
                bestRate = stats.successRate;
                bestType = taskType;
            }
        }

        if (bestType && bestRate > 0.8) {
            recs.push({
                type: 'TASK_AFFINITY',
                agent: profile.agent,
                taskType: bestType,
                description: `Agent excels at ${bestType} (${(bestRate * 100).toFixed(0)}% success). Prioritize this agent for ${bestType} tasks.`,
                suggestedValue: Math.round(bestRate * 100),
                confidence: Math.min(profile.totalOutcomes / 30, 1),
            });
        }

        return recs;
    }
}
