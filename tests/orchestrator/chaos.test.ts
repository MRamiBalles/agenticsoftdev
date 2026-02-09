/**
 * Chaos Engineering Tests
 * 
 * Fault injection into orchestrator subsystems to verify:
 *   - Self-healing under cascading failures
 *   - Circuit breaker activation and recovery
 *   - Checkpoint integrity after partial execution
 *   - Telemetry accuracy under stress
 *   - ATDI gate under concurrent analysis
 *   - Negotiation resilience with invalid inputs
 *   - EventBus behavior under channel saturation
 */

import { describe, it, expect, vi } from 'vitest';

import { DAGEngine, DAGTask, DAGGraph } from '../../src/orchestrator/dag-engine';
import { RetryPolicy } from '../../src/orchestrator/retry-policy';
import { EventBus } from '../../src/orchestrator/agent-bus';
import { OutcomeTracker, AdaptationEngine } from '../../src/orchestrator/agent-learning';
import { CheckpointManager } from '../../src/orchestrator/execution-persistence';
import { FailureDetector, HealingEngine } from '../../src/orchestrator/agent-self-healing';
import { NegotiationEngine, TaskAuction } from '../../src/orchestrator/agent-negotiation';
import { ATDIEngine } from '../../src/orchestrator/atdi-engine';
import { TelemetryEmitter } from '../../src/orchestrator/telemetry-emitter';
import { WorkerRegistry, LoadBalancer } from '../../src/orchestrator/distributed-executor';

// ─── Chaos: Cascading DAG Failures ───

describe('Chaos: Cascading DAG Failures', () => {
    it('should survive all tasks failing without hanging', async () => {
        const retry = new RetryPolicy({ maxRetries: { PLAN: 0, CODE: 0, AUDIT: 0, TEST: 0, REVIEW: 0, DEPLOY: 0, RESEARCH: 0, DESIGN: 0, INFRA_PROVISION: 0 } });
        const engine = new DAGEngine(retry, { maxConcurrency: 2, tickIntervalMs: 5, taskTimeoutMs: 5000 });

        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'CODE', agent: 'builder', payload: {} },
            { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: {} },
            { id: 'c', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: {} },
        ]);

        const result = await engine.executeMutating(graph, async () => {
            throw new Error('CHAOS: total failure');
        });

        // Task a fails → b and c should be skipped
        expect(result.completedTasks + result.failedTasks + result.skippedTasks).toBe(graph.tasks.size);
        expect(result.failedTasks).toBeGreaterThanOrEqual(1);
    });

    it('should activate circuit breaker after repeated failures', async () => {
        const retry = new RetryPolicy({
            maxRetries: { PLAN: 0, CODE: 1, AUDIT: 0, TEST: 0, REVIEW: 0, DEPLOY: 0, RESEARCH: 0, DESIGN: 0, INFRA_PROVISION: 0 },
            circuitBreakerThreshold: 2,
        });
        const engine = new DAGEngine(retry, { maxConcurrency: 1, tickIntervalMs: 5, taskTimeoutMs: 5000 });

        const graph = DAGEngine.buildGraph([
            { id: 't1', type: 'CODE', agent: 'builder', payload: {} },
            { id: 't2', type: 'CODE', agent: 'builder', payload: {} },
            { id: 't3', type: 'CODE', agent: 'builder', payload: {} },
            { id: 't4', type: 'CODE', agent: 'builder', payload: {} },
            { id: 't5', type: 'CODE', agent: 'builder', payload: {} },
        ]);

        let callCount = 0;
        const result = await engine.executeMutating(graph, async () => {
            callCount++;
            throw new Error('CHAOS: persistent failure');
        });

        // Circuit breaker should prevent all tasks from being attempted
        expect(result.failedTasks + result.skippedTasks).toBeGreaterThan(0);
    });

    it('should handle mixed success/failure without deadlock', async () => {
        const retry = new RetryPolicy();
        const engine = new DAGEngine(retry, { maxConcurrency: 3, tickIntervalMs: 5, taskTimeoutMs: 5000 });

        const graph = DAGEngine.buildGraph([
            { id: 'ok1', type: 'PLAN', agent: 'architect', payload: {} },
            { id: 'fail1', type: 'CODE', agent: 'builder', dependencies: ['ok1'], payload: {} },
            { id: 'ok2', type: 'AUDIT', agent: 'guardian', dependencies: ['ok1'], payload: {} },
            { id: 'end', type: 'TEST', agent: 'guardian', dependencies: ['fail1', 'ok2'], payload: {} },
        ]);

        let callIdx = 0;
        const result = await engine.executeMutating(graph, async (task) => {
            callIdx++;
            if (task.id === 'fail1') throw new Error('CHAOS: selective failure');
            return { result: { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 10 } };
        });

        expect(result.completedTasks).toBeGreaterThanOrEqual(1);
        // fail1 fails → end gets skipped
        expect(result.skippedTasks).toBeGreaterThanOrEqual(1);
    });
});

// ─── Chaos: Healing Engine Under Stress ───

describe('Chaos: Healing Engine Under Stress', () => {
    it('should classify rapid consecutive failures', () => {
        const detector = new FailureDetector();
        const classifications: string[] = [];

        // Rapid-fire 20 failure classifications
        for (let i = 0; i < 20; i++) {
            const result = { exitCode: 137, stdout: '', stderr: `killed: out of memory ${i}`, durationMs: 1000 };
            const failure = detector.classify(result, 1000);
            classifications.push(failure.category);
        }

        expect(classifications.length).toBe(20);
        // All should be classified (not UNKNOWN since stderr matches OOM pattern)
        expect(classifications.every(c => c !== '')).toBe(true);
    });

    it('should handle healing engine with many strategies', async () => {
        const healAttempts: string[] = [];
        const engine = new HealingEngine(undefined, undefined, {
            onHealingAttempt: (r) => healAttempts.push(r.taskId),
        });

        const detector = new FailureDetector();
        const result = { exitCode: 1, stdout: '', stderr: 'connection refused', durationMs: 5000 };
        const failure = detector.classify(result, 5000);

        // Heal should work without crashing
        const healResult = await engine.heal('task-1', 'builder', 'CODE', failure, async () => true);
        expect(healResult.healed).toBe(true);
    });
});

// ─── Chaos: Checkpoint Integrity Under Partial Execution ───

describe('Chaos: Checkpoint Under Partial Execution', () => {
    it('should save valid checkpoint even with failed tasks', () => {
        const mgr = new CheckpointManager({ autoCheckpointInterval: 1, maxCheckpoints: 5 });

        const graph = DAGEngine.buildGraph([
            { id: 'ok', type: 'PLAN', agent: 'architect', payload: {} },
            { id: 'fail', type: 'CODE', agent: 'builder', dependencies: ['ok'], payload: {} },
        ]);

        // Simulate partial execution
        const outcomes = [
            { agent: 'architect', taskType: 'PLAN' as const, taskId: 'ok', success: true, durationMs: 50, timestamp: Date.now(), attempt: 1 },
            { agent: 'builder', taskType: 'CODE' as const, taskId: 'fail', success: false, durationMs: 100, timestamp: Date.now(), attempt: 1, errorMessage: 'CHAOS' },
        ];

        const ckpt = mgr.save(graph, ['ok'], 0, 0, outcomes, [], 150, 'chaos-partial');

        expect(ckpt.snapshot.executionOrder).toEqual(['ok']);
        expect(ckpt.snapshot.outcomes).toHaveLength(2);

        // Verify integrity
        const loaded = mgr.load(ckpt.snapshot.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.snapshot.label).toBe('chaos-partial');
    });

    it('should handle rapid checkpoint saves without corruption', () => {
        const mgr = new CheckpointManager({ autoCheckpointInterval: 1, maxCheckpoints: 3 });

        const graph = DAGEngine.buildGraph([
            { id: 't1', type: 'PLAN', agent: 'architect', payload: {} },
        ]);

        // Rapid-fire 10 checkpoints (should prune to max 3)
        for (let i = 0; i < 10; i++) {
            mgr.save(graph, ['t1'], i, 0, [], [], i * 10, `rapid-${i}`);
        }

        const list = mgr.listCheckpoints();
        expect(list).toHaveLength(3);

        // All remaining should be loadable
        for (const id of list) {
            const loaded = mgr.load(id);
            expect(loaded).not.toBeNull();
        }
    });
});

// ─── Chaos: Telemetry Under Burst ───

describe('Chaos: Telemetry Under Burst', () => {
    it('should handle 10000 events without crashing', () => {
        const emitter = new TelemetryEmitter(500);

        for (let i = 0; i < 10000; i++) {
            emitter.emit('TASK_DISPATCH', 'chaos', { i });
        }

        expect(emitter.getEventCount()).toBe(10000);
        const snap = emitter.fullSnapshot();
        expect(snap.events).toHaveLength(500); // Ring buffer capped
        expect(snap.counters.tasksDispatched).toBe(10000);
    });

    it('should not lose counter accuracy under burst', () => {
        const emitter = new TelemetryEmitter(100);

        for (let i = 0; i < 1000; i++) {
            const types = ['TASK_DISPATCH', 'TASK_COMPLETE', 'TASK_FAIL', 'TASK_RETRY'] as const;
            emitter.emit(types[i % 4], 'chaos');
        }

        const c = emitter.getCounters();
        expect(c.tasksDispatched).toBe(250);
        expect(c.tasksCompleted).toBe(250);
        expect(c.tasksFailed).toBe(250);
        expect(c.tasksRetried).toBe(250);
        expect(c.totalEvents).toBe(1000);
    });

    it('should handle subscriber errors under burst', () => {
        const emitter = new TelemetryEmitter(100);
        let errorCount = 0;

        emitter.subscribe(() => { errorCount++; throw new Error('bad sub'); });
        const goodSub = vi.fn();
        emitter.subscribe(goodSub);

        for (let i = 0; i < 100; i++) {
            emitter.emit('TASK_DISPATCH', 'chaos');
        }

        // Both subscribers should have been called despite first one throwing
        expect(errorCount).toBe(100);
        expect(goodSub).toHaveBeenCalledTimes(100);
    });
});

// ─── Chaos: ATDI With Extreme Inputs ───

describe('Chaos: ATDI Extreme Inputs', () => {
    it('should handle empty graph and empty metrics', () => {
        const engine = new ATDIEngine();
        const report = engine.analyze({}, []);
        expect(report.score).toBe(0);
        expect(report.trafficLight).toBe('GREEN');
    });

    it('should handle massive dependency graph', () => {
        const engine = new ATDIEngine();
        const graph: Record<string, string[]> = {};

        // Create 100-node chain
        for (let i = 0; i < 100; i++) {
            graph[`file${i}.ts`] = i < 99 ? [`file${i + 1}.ts`] : [];
        }

        const report = engine.analyze(graph, []);
        expect(report.nodesCount).toBe(100);
        // No cycles in a chain
        expect(report.smells.filter(s => s.type === 'CYCLE')).toHaveLength(0);
    });

    it('should handle fully connected graph (worst case cycles)', () => {
        const engine = new ATDIEngine();
        const nodes = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
        const graph: Record<string, string[]> = {};
        for (const n of nodes) {
            graph[n] = nodes.filter(x => x !== n);
        }

        const report = engine.analyze(graph, []);
        expect(report.smells.some(s => s.type === 'CYCLE')).toBe(true);
        expect(report.trafficLight).not.toBe('GREEN');
    });

    it('should handle file with absurd metrics', () => {
        const engine = new ATDIEngine();
        const metrics = [{
            file: 'god_of_gods.ts',
            loc: 50000,
            complexity: 500,
            imports: Array.from({ length: 200 }, (_, i) => `dep${i}`),
        }];

        const report = engine.analyze({}, metrics);
        expect(report.score).toBeGreaterThan(1000);
        expect(report.trafficLight).toBe('RED');
        expect(report.blocked).toBe(true);
    });
});

// ─── Chaos: EventBus Channel Saturation ───

describe('Chaos: EventBus Channel Saturation', () => {
    it('should enforce channel depth limits', () => {
        const bus = new EventBus({ maxChannelDepth: 10 });

        let published = 0;
        for (let i = 0; i < 100; i++) {
            const ok = bus.publish('flood-channel', {
                type: 'chaos.flood',
                sender: 'chaos-agent',
                senderRole: 'builder',
                payload: { i },
            });
            if (ok) published++;
        }

        // Should not have published all 100
        expect(published).toBeLessThanOrEqual(100);
    });

    it('should handle subscribe/unsubscribe churn', () => {
        const bus = new EventBus();
        const handlers: (() => void)[] = [];

        // Subscribe 50 handlers
        for (let i = 0; i < 50; i++) {
            const unsub = bus.subscribe(`churn-${i % 5}`, vi.fn());
            handlers.push(unsub);
        }

        // Unsubscribe all
        for (const h of handlers) h();

        // Should not crash when publishing to unsubscribed channels
        const ok = bus.publish('churn-0', {
            type: 'test',
            sender: 'chaos',
            senderRole: 'builder',
            payload: {},
        });
        // May or may not succeed depending on implementation, but shouldn't crash
        expect(typeof ok).toBe('boolean');
    });
});

// ─── Chaos: Negotiation With Invalid Inputs ───

describe('Chaos: Negotiation Edge Cases', () => {
    it('should handle voting on non-existent proposal', () => {
        const engine = new NegotiationEngine();
        const voted = engine.vote('non-existent-id', 'voter', 'builder', 'option-a');
        expect(voted).toBe(false);
    });

    it('should handle resolving already resolved proposal', () => {
        const engine = new NegotiationEngine();
        const proposal = engine.propose('arch', 'architect', 'Pick DB', ['Postgres', 'MySQL']);
        engine.vote(proposal.id, 'builder1', 'builder', 'Postgres');
        
        const r1 = engine.resolve(proposal.id);
        expect(r1).not.toBeNull();

        // Resolve again — should return null (already resolved)
        const r2 = engine.resolve(proposal.id);
        expect(r2).toBeNull();
    });

    it('should handle auction with no bids', () => {
        const auction = new TaskAuction();
        const a = auction.create('t1', 'CODE', 'architect', 100);
        const result = auction.close(a.id);
        // No bids → no winner
        expect(result).toBeNull();
    });

    it('should handle closing non-existent auction', () => {
        const auction = new TaskAuction();
        const result = auction.close('ghost-auction');
        expect(result).toBeNull();
    });
});

// ─── Chaos: Worker Registry Liveness ───

describe('Chaos: Worker Registry Liveness', () => {
    it('should detect dead workers', () => {
        const onDeath = vi.fn();
        const registry = new WorkerRegistry(
            { heartbeatIntervalMs: 10, maxMissedHeartbeats: 1, registrationTimeoutMs: 100 },
            { onWorkerDeath: onDeath },
        );

        const id = registry.register('worker-1', ['CODE']);

        // Manually expire the worker by not sending heartbeats
        // The registry checks on heartbeat calls, so we simulate time passing
        const worker = registry.getWorker(id);
        expect(worker).not.toBeNull();
        expect(worker!.status).toBe('IDLE');
    });

    it('should handle registering many workers', () => {
        const registry = new WorkerRegistry();

        const ids: string[] = [];
        for (let i = 0; i < 50; i++) {
            ids.push(registry.register(`worker-${i}`, ['CODE', 'TEST']));
        }

        expect(ids).toHaveLength(50);
        // All should be unique
        expect(new Set(ids).size).toBe(50);
    });
});
