/**
 * Agent Self-Healing Tests
 * 
 * Validates: failure detection (OOM, timeout, crash, dependency, permission,
 * network), healing actions in priority order, escalation triggers,
 * healing records, success rates, integration with executor.
 * 
 * Phase 4.7: Agent Self-Healing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    FailureDetector,
    HealingEngine,
    FailureClassification,
    HealingRecord,
    EscalationEvent,
    HealingAction,
    HealingResult,
} from '../../src/orchestrator/agent-self-healing';
import { DAGTaskResult } from '../../src/orchestrator/dag-engine';

// ─── Helpers ───

function makeResult(overrides: Partial<DAGTaskResult> = {}): DAGTaskResult {
    return {
        exitCode: 1,
        stdout: '',
        stderr: 'error occurred',
        durationMs: 100,
        ...overrides,
    };
}

function successExecutor(): (taskId: string, action: HealingAction, failure: FailureClassification) => Promise<boolean> {
    return async () => true;
}

function failExecutor(): (taskId: string, action: HealingAction, failure: FailureClassification) => Promise<boolean> {
    return async () => false;
}

function selectiveExecutor(succeedOn: Set<string>): (taskId: string, action: HealingAction, failure: FailureClassification) => Promise<boolean> {
    return async (_taskId, action) => succeedOn.has(action.type);
}

// ─── FailureDetector: Classification ───

describe('FailureDetector - Classification', () => {
    let detector: FailureDetector;

    beforeEach(() => {
        detector = new FailureDetector();
    });

    it('should detect OOM from stderr', () => {
        const result = makeResult({ stderr: 'JavaScript heap out of memory', exitCode: 137 });
        const classification = detector.classify(result);

        expect(classification.category).toBe('OOM');
        expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
        expect(classification.signals.length).toBeGreaterThan(0);
    });

    it('should detect OOM from exit code 137', () => {
        const result = makeResult({ stderr: '', exitCode: 137 });
        const classification = detector.classify(result);

        expect(classification.category).toBe('OOM');
        expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should detect TIMEOUT from stderr', () => {
        const result = makeResult({ stderr: 'Error: execution timed out after 30s' });
        const classification = detector.classify(result);

        expect(classification.category).toBe('TIMEOUT');
        expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect TIMEOUT from long duration', () => {
        const result = makeResult({ stderr: '', exitCode: 124 });
        const classification = detector.classify(result, 30000);

        expect(classification.category).toBe('TIMEOUT');
    });

    it('should detect DEPENDENCY_FAILURE from stderr', () => {
        const result = makeResult({ stderr: 'Error: Cannot find module \'lodash\'' });
        const classification = detector.classify(result);

        expect(classification.category).toBe('DEPENDENCY_FAILURE');
        expect(classification.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect PERMISSION_DENIED from stderr', () => {
        const result = makeResult({ stderr: 'Error: EACCES: permission denied, open \'/etc/passwd\'' });
        const classification = detector.classify(result);

        expect(classification.category).toBe('PERMISSION_DENIED');
        expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect NETWORK_ERROR from stderr', () => {
        const result = makeResult({ stderr: 'Error: connect ECONNREFUSED 127.0.0.1:5432' });
        const classification = detector.classify(result);

        expect(classification.category).toBe('NETWORK_ERROR');
        expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect CRASH from stderr', () => {
        const result = makeResult({ stderr: 'Segmentation fault (core dumped)', exitCode: 139 });
        const classification = detector.classify(result);

        expect(classification.category).toBe('CRASH');
        expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should classify UNKNOWN for unrecognized errors', () => {
        const result = makeResult({ stderr: 'something weird happened', exitCode: 42 });
        const classification = detector.classify(result);

        expect(classification.category).toBe('UNKNOWN');
        expect(classification.confidence).toBeLessThan(0.5);
    });

    it('should include stderr and exitCode in classification', () => {
        const result = makeResult({ stderr: 'ENOMEM', exitCode: 137 });
        const classification = detector.classify(result);

        expect(classification.stderr).toBe('ENOMEM');
        expect(classification.exitCode).toBe(137);
    });

    it('should include duration in classification', () => {
        const result = makeResult({ stderr: 'timeout', exitCode: 124 });
        const classification = detector.classify(result, 5000);

        expect(classification.durationMs).toBe(5000);
    });

    it('should detect OOM keywords: ENOMEM', () => {
        const result = makeResult({ stderr: 'ENOMEM: not enough space' });
        const classification = detector.classify(result);
        expect(classification.category).toBe('OOM');
    });

    it('should detect network keywords: socket hang up', () => {
        const result = makeResult({ stderr: 'Error: socket hang up' });
        const classification = detector.classify(result);
        expect(classification.category).toBe('NETWORK_ERROR');
    });

    it('should detect crash keywords: unhandled exception', () => {
        const result = makeResult({ stderr: 'unhandled exception in worker thread' });
        const classification = detector.classify(result);
        expect(classification.category).toBe('CRASH');
    });
});

// ─── HealingEngine: Basic Healing ───

describe('HealingEngine - Basic Healing', () => {
    let engine: HealingEngine;

    beforeEach(() => {
        engine = new HealingEngine();
    });

    it('should heal a task with first action', async () => {
        const failure: FailureClassification = {
            category: 'CRASH',
            confidence: 0.9,
            signals: ['stderr matches: segmentation fault'],
            exitCode: 139,
        };

        const result = await engine.heal('task-1', 'builder-1', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('RESTART');
        expect(result.attempts).toHaveLength(1);
    });

    it('should try second action if first fails', async () => {
        const failure: FailureClassification = {
            category: 'CRASH',
            confidence: 0.9,
            signals: ['crash detected'],
            exitCode: 139,
        };

        // Only succeed on REROUTE (second action for CRASH)
        const result = await engine.heal('task-1', 'builder-1', 'CODE', failure, selectiveExecutor(new Set(['REROUTE'])));

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('REROUTE');
        expect(result.attempts.length).toBeGreaterThanOrEqual(2);
    });

    it('should escalate when all actions fail', async () => {
        const failure: FailureClassification = {
            category: 'CRASH',
            confidence: 0.9,
            signals: ['crash'],
            exitCode: 139,
        };

        const result = await engine.heal('task-1', 'builder-1', 'CODE', failure, failExecutor());

        expect(result.healed).toBe(false);
        expect(result.escalation).toBeDefined();
        expect(result.escalation!.level).toBe('ALERT');
    });

    it('should record healing attempts', async () => {
        const failure: FailureClassification = {
            category: 'OOM',
            confidence: 0.9,
            signals: ['OOM'],
        };

        await engine.heal('task-1', 'builder-1', 'CODE', failure, successExecutor());

        expect(engine.getRecords()).toHaveLength(1);
        expect(engine.getRecords()[0].taskId).toBe('task-1');
        expect(engine.getRecords()[0].success).toBe(true);
    });
});

// ─── HealingEngine: Escalation Triggers ───

describe('HealingEngine - Escalation Triggers', () => {
    it('should escalate immediately for critical task types', async () => {
        const engine = new HealingEngine(undefined, { criticalTaskTypes: ['PLAN', 'DEPLOY'] });

        const failure: FailureClassification = {
            category: 'CRASH',
            confidence: 0.9,
            signals: ['crash'],
        };

        const result = await engine.heal('task-1', 'architect', 'PLAN', failure, successExecutor());

        expect(result.healed).toBe(false);
        expect(result.escalation).toBeDefined();
        expect(result.escalation!.reason).toContain('Critical task type');
    });

    it('should escalate when confidence is below threshold', async () => {
        const engine = new HealingEngine(undefined, { minConfidence: 0.5 });

        const failure: FailureClassification = {
            category: 'UNKNOWN',
            confidence: 0.3,
            signals: ['low confidence'],
        };

        const result = await engine.heal('task-1', 'builder-1', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(false);
        expect(result.escalation).toBeDefined();
        expect(result.escalation!.reason).toContain('Low confidence');
    });

    it('should escalate after max healing attempts', async () => {
        const engine = new HealingEngine(undefined, { maxHealingAttempts: 2 });

        const failure: FailureClassification = {
            category: 'TIMEOUT',
            confidence: 0.9,
            signals: ['timeout'],
        };

        // First heal: fails all actions, records attempts
        await engine.heal('task-1', 'builder-1', 'CODE', failure, failExecutor());

        // Second heal for same task: should escalate immediately due to max attempts
        const result = await engine.heal('task-1', 'builder-1', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(false);
        expect(result.escalation).toBeDefined();
        expect(result.escalation!.reason).toContain('Max healing attempts');
    });

    it('should escalate for PERMISSION_DENIED (only ESCALATE in strategy)', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = {
            category: 'PERMISSION_DENIED',
            confidence: 0.9,
            signals: ['EACCES'],
        };

        const result = await engine.heal('task-1', 'builder-1', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(false);
        expect(result.escalation).toBeDefined();
    });
});

// ─── HealingEngine: Callbacks ───

describe('HealingEngine - Callbacks', () => {
    it('should fire onFailureDetected', async () => {
        const detected: { classification: FailureClassification; taskId: string }[] = [];
        const engine = new HealingEngine(undefined, undefined, {
            onFailureDetected: (c, t) => detected.push({ classification: c, taskId: t }),
        });

        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(detected).toHaveLength(1);
        expect(detected[0].taskId).toBe('task-1');
    });

    it('should fire onHealingAttempt for each attempt', async () => {
        const attempts: HealingRecord[] = [];
        const engine = new HealingEngine(undefined, undefined, {
            onHealingAttempt: (r) => attempts.push(r),
        });

        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, failExecutor());

        // CRASH strategy has RESTART + REROUTE before ESCALATE
        expect(attempts.length).toBeGreaterThanOrEqual(2);
    });

    it('should fire onHealingSuccess on success', async () => {
        const successes: HealingRecord[] = [];
        const engine = new HealingEngine(undefined, undefined, {
            onHealingSuccess: (r) => successes.push(r),
        });

        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(successes).toHaveLength(1);
        expect(successes[0].success).toBe(true);
    });

    it('should fire onEscalation when escalating', async () => {
        const escalations: EscalationEvent[] = [];
        const engine = new HealingEngine(undefined, undefined, {
            onEscalation: (e) => escalations.push(e),
        });

        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, failExecutor());

        expect(escalations).toHaveLength(1);
        expect(escalations[0].level).toBe('ALERT');
    });
});

// ─── HealingEngine: Records & Stats ───

describe('HealingEngine - Records & Stats', () => {
    it('should track records across multiple heals', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'NETWORK_ERROR', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());
        await engine.heal('task-2', 'builder', 'TEST', failure, successExecutor());

        expect(engine.getRecords()).toHaveLength(2);
    });

    it('should filter records by task', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'NETWORK_ERROR', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());
        await engine.heal('task-2', 'builder', 'CODE', failure, failExecutor());

        expect(engine.getTaskRecords('task-1')).toHaveLength(1);
        expect(engine.getTaskRecords('task-1')[0].success).toBe(true);
    });

    it('should compute success rate', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor()); // 1 success
        await engine.heal('task-2', 'builder', 'CODE', failure, failExecutor());    // 2 failures (RESTART + REROUTE)

        const rate = engine.getSuccessRate();
        // 1 success out of 3 total attempts
        expect(rate).toBeCloseTo(1 / 3, 1);
    });

    it('should return 0 success rate with no records', () => {
        const engine = new HealingEngine();
        expect(engine.getSuccessRate()).toBe(0);
    });

    it('should reset all state', async () => {
        const engine = new HealingEngine();
        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };
        await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        engine.reset();
        expect(engine.getRecords()).toHaveLength(0);
    });
});

// ─── HealingEngine: Strategy Specific ───

describe('HealingEngine - Strategy Specific', () => {
    it('should try SCALE_DOWN first for OOM', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'OOM', confidence: 0.9, signals: ['OOM'] };
        const result = await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('SCALE_DOWN');
    });

    it('should try RETRY_WITH_BACKOFF first for TIMEOUT', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'TIMEOUT', confidence: 0.9, signals: ['timeout'] };
        const result = await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('RETRY_WITH_BACKOFF');
    });

    it('should try SKIP_DEPENDENCY first for DEPENDENCY_FAILURE', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'DEPENDENCY_FAILURE', confidence: 0.9, signals: ['module not found'] };
        const result = await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('SKIP_DEPENDENCY');
    });

    it('should try RETRY_WITH_BACKOFF first for NETWORK_ERROR', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'NETWORK_ERROR', confidence: 0.9, signals: ['ECONNREFUSED'] };
        const result = await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('RETRY_WITH_BACKOFF');
    });

    it('should try RESTART first for UNKNOWN', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'UNKNOWN', confidence: 0.6, signals: ['unknown'] };
        const result = await engine.heal('task-1', 'builder', 'CODE', failure, successExecutor());

        expect(result.healed).toBe(true);
        expect(result.successfulAction).toBe('RESTART');
    });
});

// ─── HealingEngine: Policy Access ───

describe('HealingEngine - Policy & Strategies', () => {
    it('should expose escalation policy', () => {
        const engine = new HealingEngine(undefined, { maxHealingAttempts: 5 });
        const policy = engine.getPolicy();
        expect(policy.maxHealingAttempts).toBe(5);
    });

    it('should expose strategies', () => {
        const engine = new HealingEngine();
        const strategies = engine.getStrategies();
        expect(strategies.size).toBeGreaterThanOrEqual(6);
        expect(strategies.has('OOM')).toBe(true);
        expect(strategies.has('TIMEOUT')).toBe(true);
        expect(strategies.has('CRASH')).toBe(true);
    });
});

// ─── Integration: Detect + Heal ───

describe('Integration - Detect + Heal', () => {
    it('should detect failure and heal in pipeline', async () => {
        const detector = new FailureDetector();
        const engine = new HealingEngine();

        const taskResult = makeResult({ stderr: 'Error: connect ECONNREFUSED 127.0.0.1:3000', exitCode: 1 });
        const classification = detector.classify(taskResult);

        expect(classification.category).toBe('NETWORK_ERROR');

        const healResult = await engine.heal('task-1', 'builder', 'CODE', classification, successExecutor());
        expect(healResult.healed).toBe(true);
        expect(healResult.successfulAction).toBe('RETRY_WITH_BACKOFF');
    });

    it('should detect OOM and scale down', async () => {
        const detector = new FailureDetector();
        const engine = new HealingEngine();

        const taskResult = makeResult({ stderr: 'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory', exitCode: 137 });
        const classification = detector.classify(taskResult);

        expect(classification.category).toBe('OOM');

        const healResult = await engine.heal('task-1', 'builder', 'CODE', classification, successExecutor());
        expect(healResult.healed).toBe(true);
        expect(healResult.successfulAction).toBe('SCALE_DOWN');
    });

    it('should handle executor throwing errors gracefully', async () => {
        const engine = new HealingEngine();

        const failure: FailureClassification = { category: 'CRASH', confidence: 0.9, signals: [] };

        const throwingExecutor = async () => { throw new Error('executor crashed'); };
        const result = await engine.heal('task-1', 'builder', 'CODE', failure, throwingExecutor);

        // Should not throw, should escalate after all actions fail
        expect(result.healed).toBe(false);
        expect(result.escalation).toBeDefined();
    });
});
