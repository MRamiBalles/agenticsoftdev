/**
 * Agent Learning & Adaptation Tests
 * 
 * Validates: outcome tracking, rolling window, performance stats,
 * decay weighting, agent profiles, retry tuning, bid calibration,
 * task affinity, failure pattern detection.
 * 
 * Phase 4.4: Agent Learning & Adaptation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    OutcomeTracker,
    AdaptationEngine,
    TaskOutcome,
    PerformanceStats,
    AgentProfile,
    AdaptationRecommendation,
} from '../../src/orchestrator/agent-learning';

// ─── Helpers ───

function makeOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
    return {
        agent: 'builder-1',
        agentRole: 'builder',
        taskType: 'CODE',
        taskId: `task_${Date.now()}`,
        success: true,
        exitCode: 0,
        durationMs: 100,
        retryCount: 0,
        depth: 0,
        timestamp: Date.now(),
        ...overrides,
    };
}

function recordMany(tracker: OutcomeTracker, count: number, overrides: Partial<TaskOutcome> = {}): void {
    for (let i = 0; i < count; i++) {
        tracker.record(makeOutcome({ taskId: `task_${i}`, ...overrides }));
    }
}

// ─── OutcomeTracker: Basic Recording ───

describe('OutcomeTracker - Recording', () => {
    let tracker: OutcomeTracker;

    beforeEach(() => {
        tracker = new OutcomeTracker();
    });

    it('should record a single outcome', () => {
        tracker.record(makeOutcome());
        expect(tracker.getTotalOutcomes()).toBe(1);
    });

    it('should retrieve outcomes by agent+taskType', () => {
        tracker.record(makeOutcome({ agent: 'a', taskType: 'CODE' }));
        tracker.record(makeOutcome({ agent: 'a', taskType: 'PLAN' }));
        tracker.record(makeOutcome({ agent: 'b', taskType: 'CODE' }));

        expect(tracker.getOutcomes('a', 'CODE')).toHaveLength(1);
        expect(tracker.getOutcomes('a', 'PLAN')).toHaveLength(1);
        expect(tracker.getOutcomes('b', 'CODE')).toHaveLength(1);
    });

    it('should return empty array for unknown pairs', () => {
        expect(tracker.getOutcomes('unknown', 'CODE')).toHaveLength(0);
    });

    it('should enforce rolling window (max outcomes per pair)', () => {
        const smallTracker = new OutcomeTracker({ maxOutcomesPerPair: 3 });
        for (let i = 0; i < 5; i++) {
            smallTracker.record(makeOutcome({ taskId: `task_${i}` }));
        }

        const outcomes = smallTracker.getOutcomes('builder-1', 'CODE');
        expect(outcomes).toHaveLength(3);
        expect(outcomes[0].taskId).toBe('task_2'); // oldest kept
    });

    it('should get all outcomes for an agent', () => {
        tracker.record(makeOutcome({ agent: 'a', taskType: 'CODE' }));
        tracker.record(makeOutcome({ agent: 'a', taskType: 'PLAN' }));
        tracker.record(makeOutcome({ agent: 'a', taskType: 'AUDIT' }));
        tracker.record(makeOutcome({ agent: 'b', taskType: 'CODE' }));

        expect(tracker.getAllOutcomesForAgent('a')).toHaveLength(3);
        expect(tracker.getAllOutcomesForAgent('b')).toHaveLength(1);
    });

    it('should fire onOutcomeRecorded callback', () => {
        const recorded: TaskOutcome[] = [];
        const cbTracker = new OutcomeTracker({}, { onOutcomeRecorded: (o) => recorded.push(o) });

        cbTracker.record(makeOutcome());
        expect(recorded).toHaveLength(1);
    });

    it('should reset all state', () => {
        tracker.record(makeOutcome());
        tracker.reset();
        expect(tracker.getTotalOutcomes()).toBe(0);
    });
});

// ─── OutcomeTracker: Performance Stats ───

describe('OutcomeTracker - Performance Stats', () => {
    let tracker: OutcomeTracker;

    beforeEach(() => {
        // Use very large decay half-life so decay doesn't affect tests
        tracker = new OutcomeTracker({ decayHalfLifeMs: 999_999_999 });
    });

    it('should return null for unknown pairs', () => {
        expect(tracker.computeStats('unknown', 'CODE')).toBeNull();
    });

    it('should compute success rate', () => {
        recordMany(tracker, 7, { success: true });
        recordMany(tracker, 3, { success: false, exitCode: 1, taskId: 'fail' });

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.successRate).toBeCloseTo(0.7, 1);
        expect(stats.successCount).toBe(7);
        expect(stats.failureCount).toBe(3);
    });

    it('should compute average duration', () => {
        tracker.record(makeOutcome({ durationMs: 100 }));
        tracker.record(makeOutcome({ durationMs: 200, taskId: 't2' }));
        tracker.record(makeOutcome({ durationMs: 300, taskId: 't3' }));

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.avgDurationMs).toBe(200);
    });

    it('should compute p95 duration', () => {
        // 10 fast tasks + 10 slow tasks → p95 should be in the slow bucket
        for (let i = 0; i < 10; i++) {
            tracker.record(makeOutcome({ durationMs: 100, taskId: `fast_${i}` }));
        }
        for (let i = 0; i < 10; i++) {
            tracker.record(makeOutcome({ durationMs: 5000, taskId: `slow_${i}` }));
        }

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.p95DurationMs).toBe(5000);
    });

    it('should compute retry success rate', () => {
        // 2 retried tasks, 1 succeeded, 1 failed
        tracker.record(makeOutcome({ retryCount: 1, success: true, taskId: 'r1' }));
        tracker.record(makeOutcome({ retryCount: 2, success: false, exitCode: 1, taskId: 'r2' }));
        // 1 non-retried task
        tracker.record(makeOutcome({ retryCount: 0, success: true, taskId: 'nr1' }));

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.retrySuccessRate).toBe(0.5); // 1/2 retried succeeded
        expect(stats.avgRetryCount).toBe(1); // (1+2+0)/3
    });

    it('should detect top error pattern', () => {
        tracker.record(makeOutcome({ success: false, exitCode: 1, errorPattern: 'timeout', taskId: 't1' }));
        tracker.record(makeOutcome({ success: false, exitCode: 1, errorPattern: 'timeout', taskId: 't2' }));
        tracker.record(makeOutcome({ success: false, exitCode: 1, errorPattern: 'syntax_error', taskId: 't3' }));

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.topErrorPattern).toBe('timeout');
        expect(stats.topErrorCount).toBe(2);
    });

    it('should handle 100% success rate', () => {
        recordMany(tracker, 5, { success: true });

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.successRate).toBeCloseTo(1.0, 2);
        expect(stats.failureCount).toBe(0);
    });

    it('should handle 0% success rate', () => {
        recordMany(tracker, 5, { success: false, exitCode: 1 });

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        expect(stats.successRate).toBeCloseTo(0.0, 2);
        expect(stats.successCount).toBe(0);
    });
});

// ─── OutcomeTracker: Decay ───

describe('OutcomeTracker - Exponential Decay', () => {
    it('should weight recent outcomes higher than old ones', () => {
        const tracker = new OutcomeTracker({ decayHalfLifeMs: 100 });

        // Old failure (200ms ago → weight ≈ 0.25)
        tracker.record(makeOutcome({
            success: false, exitCode: 1, taskId: 'old',
            timestamp: Date.now() - 200,
        }));

        // Recent success (just now → weight ≈ 1.0)
        tracker.record(makeOutcome({
            success: true, taskId: 'new',
            timestamp: Date.now(),
        }));

        const stats = tracker.computeStats('builder-1', 'CODE')!;
        // With decay, success rate should be significantly above 0.5
        expect(stats.successRate).toBeGreaterThan(0.6);
    });
});

// ─── OutcomeTracker: Agent Profile ───

describe('OutcomeTracker - Agent Profile', () => {
    let tracker: OutcomeTracker;

    beforeEach(() => {
        tracker = new OutcomeTracker({ decayHalfLifeMs: 999_999_999 });
    });

    it('should build profile with multiple task types', () => {
        recordMany(tracker, 5, { taskType: 'CODE' });
        recordMany(tracker, 3, { taskType: 'AUDIT', agent: 'builder-1' });

        const profile = tracker.buildProfile('builder-1', 'builder');
        expect(profile.taskStats.size).toBe(2);
        expect(profile.totalOutcomes).toBe(8);
        expect(profile.agent).toBe('builder-1');
        expect(profile.role).toBe('builder');
    });

    it('should compute overall success rate', () => {
        recordMany(tracker, 8, { taskType: 'CODE', success: true });
        recordMany(tracker, 2, { taskType: 'CODE', success: false, exitCode: 1 });

        const profile = tracker.buildProfile('builder-1', 'builder');
        expect(profile.overallSuccessRate).toBeCloseTo(0.8, 1);
    });

    it('should return empty profile for unknown agent', () => {
        const profile = tracker.buildProfile('unknown', 'builder');
        expect(profile.taskStats.size).toBe(0);
        expect(profile.totalOutcomes).toBe(0);
    });
});

// ─── AdaptationEngine: Recommendations ───

describe('AdaptationEngine - Recommendations', () => {
    let tracker: OutcomeTracker;
    let engine: AdaptationEngine;

    beforeEach(() => {
        tracker = new OutcomeTracker({ decayHalfLifeMs: 999_999_999 });
        engine = new AdaptationEngine(tracker, { minOutcomesForRecommendation: 5 });
    });

    it('should not recommend with insufficient data', () => {
        recordMany(tracker, 3, { success: true }); // less than min 5

        const recs = engine.recommend('builder-1', 'builder');
        // Only BID_CALIBRATE and TASK_AFFINITY check min outcomes, so should be empty
        expect(recs.filter(r => r.type !== 'BID_CALIBRATE')).toHaveLength(0);
    });

    it('should generate BID_CALIBRATE recommendation', () => {
        recordMany(tracker, 10, { success: true });

        const recs = engine.recommend('builder-1', 'builder');
        const bidRecs = recs.filter(r => r.type === 'BID_CALIBRATE');
        expect(bidRecs).toHaveLength(1);
        expect(bidRecs[0].suggestedValue).toBe(100); // 100% success → 100 capability
    });

    it('should generate RETRY_TUNE recommendation for low retry success', () => {
        for (let i = 0; i < 6; i++) {
            tracker.record(makeOutcome({
                success: false, exitCode: 1, retryCount: 2, taskId: `fail_${i}`,
            }));
        }

        const recs = engine.recommend('builder-1', 'builder');
        const retryRecs = recs.filter(r => r.type === 'RETRY_TUNE');
        expect(retryRecs).toHaveLength(1);
        expect(retryRecs[0].suggestedValue).toBe(0);
    });

    it('should generate FAILURE_ALERT for recurring error patterns', () => {
        for (let i = 0; i < 5; i++) {
            tracker.record(makeOutcome({
                success: false, exitCode: 1, errorPattern: 'OOM_KILLED', taskId: `oom_${i}`,
            }));
        }

        const recs = engine.recommend('builder-1', 'builder');
        const failRecs = recs.filter(r => r.type === 'FAILURE_ALERT');
        expect(failRecs).toHaveLength(1);
        expect(failRecs[0].description).toContain('OOM_KILLED');
    });

    it('should generate TASK_AFFINITY for high-performing agent', () => {
        recordMany(tracker, 10, { success: true, taskType: 'CODE' });

        const recs = engine.recommend('builder-1', 'builder');
        const affinityRecs = recs.filter(r => r.type === 'TASK_AFFINITY');
        expect(affinityRecs).toHaveLength(1);
        expect(affinityRecs[0].taskType).toBe('CODE');
    });

    it('should NOT generate TASK_AFFINITY for low-performing agent', () => {
        recordMany(tracker, 10, { success: false, exitCode: 1, taskType: 'CODE' });

        const recs = engine.recommend('builder-1', 'builder');
        const affinityRecs = recs.filter(r => r.type === 'TASK_AFFINITY');
        expect(affinityRecs).toHaveLength(0);
    });

    it('should fire onRecommendation callback', () => {
        const recs: AdaptationRecommendation[] = [];
        const cbEngine = new AdaptationEngine(tracker, { minOutcomesForRecommendation: 5 }, {
            onRecommendation: (r) => recs.push(r),
        });

        recordMany(tracker, 10, { success: true });
        cbEngine.recommend('builder-1', 'builder');

        expect(recs.length).toBeGreaterThan(0);
    });
});

// ─── AdaptationEngine: Bid Calibration ───

describe('AdaptationEngine - Bid Calibration', () => {
    let tracker: OutcomeTracker;
    let engine: AdaptationEngine;

    beforeEach(() => {
        tracker = new OutcomeTracker({ decayHalfLifeMs: 999_999_999 });
        engine = new AdaptationEngine(tracker, { minOutcomesForRecommendation: 5 });
    });

    it('should return calibrated capability based on success rate', () => {
        recordMany(tracker, 8, { success: true });
        recordMany(tracker, 2, { success: false, exitCode: 1, taskId: 'f' });

        const capability = engine.getCalibratedCapability('builder-1', 'CODE');
        expect(capability).toBe(80); // 80% success → 80 capability
    });

    it('should return calibrated duration based on p95', () => {
        for (let i = 0; i < 5; i++) {
            tracker.record(makeOutcome({ durationMs: 100, taskId: `t${i}` }));
        }
        tracker.record(makeOutcome({ durationMs: 500, taskId: 'slow' }));

        const duration = engine.getCalibratedDuration('builder-1', 'CODE');
        expect(duration).toBeDefined();
        expect(duration!).toBeGreaterThanOrEqual(100);
    });

    it('should return null for insufficient data', () => {
        recordMany(tracker, 2, { success: true }); // less than min 5

        expect(engine.getCalibratedCapability('builder-1', 'CODE')).toBeNull();
        expect(engine.getCalibratedDuration('builder-1', 'CODE')).toBeNull();
    });
});

// ─── AdaptationEngine: Task Affinity ───

describe('AdaptationEngine - Task Affinity', () => {
    let tracker: OutcomeTracker;
    let engine: AdaptationEngine;

    beforeEach(() => {
        tracker = new OutcomeTracker({ decayHalfLifeMs: 999_999_999 });
        engine = new AdaptationEngine(tracker, { minOutcomesForRecommendation: 5 });
    });

    it('should rank agents by success rate for a task type', () => {
        // Agent A: 90% success
        for (let i = 0; i < 9; i++) tracker.record(makeOutcome({ agent: 'a', success: true, taskId: `a_s${i}` }));
        tracker.record(makeOutcome({ agent: 'a', success: false, exitCode: 1, taskId: 'a_f1' }));

        // Agent B: 60% success
        for (let i = 0; i < 6; i++) tracker.record(makeOutcome({ agent: 'b', success: true, taskId: `b_s${i}` }));
        for (let i = 0; i < 4; i++) tracker.record(makeOutcome({ agent: 'b', success: false, exitCode: 1, taskId: `b_f${i}` }));

        const ranking = engine.getTaskAffinity('CODE', [
            { agent: 'a', role: 'builder' },
            { agent: 'b', role: 'builder' },
        ]);

        expect(ranking).toHaveLength(2);
        expect(ranking[0].agent).toBe('a');
        expect(ranking[1].agent).toBe('b');
    });

    it('should exclude agents with insufficient data', () => {
        recordMany(tracker, 10, { agent: 'a', success: true });
        recordMany(tracker, 2, { agent: 'b', success: true }); // too few

        const ranking = engine.getTaskAffinity('CODE', [
            { agent: 'a', role: 'builder' },
            { agent: 'b', role: 'builder' },
        ]);

        expect(ranking).toHaveLength(1);
        expect(ranking[0].agent).toBe('a');
    });
});

// ─── AdaptationEngine: Retry Tuning ───

describe('AdaptationEngine - Retry Tuning', () => {
    let tracker: OutcomeTracker;
    let engine: AdaptationEngine;

    beforeEach(() => {
        tracker = new OutcomeTracker({ decayHalfLifeMs: 999_999_999 });
        engine = new AdaptationEngine(tracker, { minOutcomesForRecommendation: 5 });
    });

    it('should suggest 0 retries for agents that never succeed on retry', () => {
        for (let i = 0; i < 6; i++) {
            tracker.record(makeOutcome({
                success: false, exitCode: 1, retryCount: 2, taskId: `fail_${i}`,
            }));
        }

        const limit = engine.getSuggestedRetryLimit('builder-1', 'CODE');
        expect(limit).toBe(0);
    });

    it('should suggest 3 retries for agents with high retry success', () => {
        for (let i = 0; i < 6; i++) {
            tracker.record(makeOutcome({
                success: true, retryCount: 1, taskId: `retry_ok_${i}`,
            }));
        }

        const limit = engine.getSuggestedRetryLimit('builder-1', 'CODE');
        expect(limit).toBe(3);
    });

    it('should suggest 1 retry for moderate retry success', () => {
        // 3 succeed on retry, 3 fail on retry → 50%
        for (let i = 0; i < 3; i++) {
            tracker.record(makeOutcome({ success: true, retryCount: 1, taskId: `rok_${i}` }));
        }
        for (let i = 0; i < 3; i++) {
            tracker.record(makeOutcome({ success: false, exitCode: 1, retryCount: 1, taskId: `rfail_${i}` }));
        }

        const limit = engine.getSuggestedRetryLimit('builder-1', 'CODE');
        expect(limit).toBe(1);
    });

    it('should return null for insufficient data', () => {
        recordMany(tracker, 2, { retryCount: 1, success: true });
        expect(engine.getSuggestedRetryLimit('builder-1', 'CODE')).toBeNull();
    });
});
