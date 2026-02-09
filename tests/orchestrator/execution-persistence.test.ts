/**
 * Execution Persistence Tests
 * 
 * Validates: checkpoint save/load, SHA-256 integrity, corruption detection,
 * graph serialization roundtrip, partial restore, auto-checkpoint interval,
 * pruning, execution replay, summary.
 * 
 * Phase 4.5: Persistent Execution State
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    CheckpointManager,
    ExecutionReplay,
    serializeGraph,
    deserializeGraph,
    Checkpoint,
    ExecutionSnapshot,
    ReplayEvent,
} from '../../src/orchestrator/execution-persistence';
import { DAGGraph, DAGTask } from '../../src/orchestrator/dag-engine';
import { AgentMessage } from '../../src/orchestrator/agent-bus';
import { TaskOutcome } from '../../src/orchestrator/agent-learning';

// ─── Helpers ───

function makeGraph(tasks: Partial<DAGTask>[]): DAGGraph {
    const graph: DAGGraph = { tasks: new Map() };
    for (const t of tasks) {
        const task: DAGTask = {
            id: t.id ?? 'task-1',
            type: t.type ?? 'CODE',
            agent: t.agent ?? 'builder',
            dependencies: t.dependencies ?? [],
            payload: t.payload ?? {},
            status: t.status ?? 'PENDING',
            result: t.result,
            retryCount: t.retryCount ?? 0,
            depth: t.depth ?? 0,
            parentId: t.parentId,
        };
        graph.tasks.set(task.id, task);
    }
    return graph;
}

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
    return {
        id: 'msg-1',
        topic: 'task.completed',
        sender: 'builder-1',
        senderRole: 'builder',
        payload: { data: 'test' },
        timestamp: Date.now(),
        ttlMs: 60000,
        ...overrides,
    };
}

function makeOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
    return {
        agent: 'builder-1',
        agentRole: 'builder',
        taskType: 'CODE',
        taskId: 'task-1',
        success: true,
        exitCode: 0,
        durationMs: 100,
        retryCount: 0,
        depth: 0,
        timestamp: Date.now(),
        ...overrides,
    };
}

function saveBasicCheckpoint(mgr: CheckpointManager, graph?: DAGGraph, label?: string): Checkpoint {
    const g = graph ?? makeGraph([
        { id: 'a', status: 'COMPLETED', result: { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 50 } },
        { id: 'b', status: 'PENDING', dependencies: ['a'] },
    ]);
    return mgr.save(g, ['a'], 0, 0, [], [], 500, label);
}

// ─── Serialization Roundtrip ───

describe('Graph Serialization', () => {
    it('should serialize and deserialize a graph losslessly', () => {
        const graph = makeGraph([
            { id: 'a', type: 'PLAN', agent: 'architect', status: 'COMPLETED', result: { exitCode: 0, stdout: 'done', stderr: '', durationMs: 100 }, depth: 0 },
            { id: 'b', type: 'CODE', agent: 'builder', status: 'PENDING', dependencies: ['a'], depth: 0, payload: { file: 'test.ts' } },
            { id: 'c', type: 'AUDIT', agent: 'guardian', status: 'FAILED', dependencies: ['b'], depth: 1, parentId: 'a', result: { exitCode: 1, stdout: '', stderr: 'error', durationMs: 200 } },
        ]);

        const serialized = serializeGraph(graph);
        const restored = deserializeGraph(serialized);

        expect(restored.tasks.size).toBe(3);

        const taskA = restored.tasks.get('a')!;
        expect(taskA.type).toBe('PLAN');
        expect(taskA.status).toBe('COMPLETED');
        expect(taskA.result?.exitCode).toBe(0);

        const taskB = restored.tasks.get('b')!;
        expect(taskB.dependencies).toEqual(['a']);
        expect(taskB.payload).toEqual({ file: 'test.ts' });

        const taskC = restored.tasks.get('c')!;
        expect(taskC.parentId).toBe('a');
        expect(taskC.depth).toBe(1);
        expect(taskC.result?.stderr).toBe('error');
    });

    it('should handle empty graph', () => {
        const graph = makeGraph([]);
        const serialized = serializeGraph(graph);
        const restored = deserializeGraph(serialized);
        expect(restored.tasks.size).toBe(0);
    });
});

// ─── CheckpointManager: Save & Load ───

describe('CheckpointManager - Save & Load', () => {
    let mgr: CheckpointManager;

    beforeEach(() => {
        mgr = new CheckpointManager();
    });

    it('should save a checkpoint and return it', () => {
        const ckpt = saveBasicCheckpoint(mgr);

        expect(ckpt.snapshot.id).toBeDefined();
        expect(ckpt.hash).toBeDefined();
        expect(ckpt.hash).toHaveLength(64); // SHA-256 hex
        expect(ckpt.sizeBytes).toBeGreaterThan(0);
    });

    it('should load a saved checkpoint by ID', () => {
        const ckpt = saveBasicCheckpoint(mgr);
        const result = mgr.load(ckpt.snapshot.id);

        expect(result.success).toBe(true);
        expect(result.snapshot).toBeDefined();
        expect(result.graph).toBeDefined();
        expect(result.graph!.tasks.size).toBe(2);
    });

    it('should return error for non-existent checkpoint', () => {
        const result = mgr.load('fake-id');
        expect(result.success).toBe(false);
        expect(result.error).toContain('CHECKPOINT_NOT_FOUND');
    });

    it('should preserve completed tasks and re-queue pending ones', () => {
        const ckpt = saveBasicCheckpoint(mgr);
        const result = mgr.load(ckpt.snapshot.id);

        expect(result.preserved).toContain('a');
        expect(result.requeued).toContain('b');

        // Re-queued task should be PENDING
        const taskB = result.graph!.tasks.get('b')!;
        expect(taskB.status).toBe('PENDING');
    });

    it('should re-queue RUNNING tasks as PENDING', () => {
        const graph = makeGraph([
            { id: 'x', status: 'RUNNING' },
        ]);
        const ckpt = mgr.save(graph, [], 0, 0, [], [], 100);
        const result = mgr.load(ckpt.snapshot.id);

        expect(result.requeued).toContain('x');
        expect(result.graph!.tasks.get('x')!.status).toBe('PENDING');
    });

    it('should preserve FAILED and SKIPPED tasks', () => {
        const graph = makeGraph([
            { id: 'f', status: 'FAILED', result: { exitCode: 1, stdout: '', stderr: 'err', durationMs: 10 } },
            { id: 's', status: 'SKIPPED' },
        ]);
        const ckpt = mgr.save(graph, [], 0, 0, [], [], 100);
        const result = mgr.load(ckpt.snapshot.id);

        expect(result.preserved).toContain('f');
        expect(result.preserved).toContain('s');
    });

    it('should include execution metadata in snapshot', () => {
        const graph = makeGraph([{ id: 'a', status: 'COMPLETED', result: { exitCode: 0, stdout: '', stderr: '', durationMs: 50 } }]);
        const ckpt = mgr.save(graph, ['a'], 3, 2, [makeOutcome()], [makeMessage()], 1500, 'test-label');

        expect(ckpt.snapshot.executionOrder).toEqual(['a']);
        expect(ckpt.snapshot.totalRetries).toBe(3);
        expect(ckpt.snapshot.totalSpawned).toBe(2);
        expect(ckpt.snapshot.outcomes).toHaveLength(1);
        expect(ckpt.snapshot.messages).toHaveLength(1);
        expect(ckpt.snapshot.elapsedMs).toBe(1500);
        expect(ckpt.snapshot.label).toBe('test-label');
    });

    it('should load latest checkpoint', () => {
        saveBasicCheckpoint(mgr, undefined, 'first');
        saveBasicCheckpoint(mgr, undefined, 'second');

        const result = mgr.loadLatest();
        expect(result.success).toBe(true);
        expect(result.snapshot!.label).toBe('second');
    });

    it('should return error when no checkpoints exist for loadLatest', () => {
        const result = mgr.loadLatest();
        expect(result.success).toBe(false);
        expect(result.error).toBe('NO_CHECKPOINTS');
    });
});

// ─── CheckpointManager: Integrity Verification ───

describe('CheckpointManager - Integrity', () => {
    it('should detect tampered checkpoint', () => {
        const violations: { id: string; expected: string; actual: string }[] = [];
        const mgr = new CheckpointManager({ verifyOnLoad: true }, {
            onIntegrityViolation: (id, expected, actual) => violations.push({ id, expected, actual }),
        });

        const ckpt = saveBasicCheckpoint(mgr);

        // Tamper with the snapshot
        ckpt.snapshot.totalRetries = 999;

        const result = mgr.load(ckpt.snapshot.id);
        expect(result.success).toBe(false);
        expect(result.error).toContain('INTEGRITY_VIOLATION');
        expect(violations).toHaveLength(1);
    });

    it('should pass integrity check for untampered checkpoint', () => {
        const mgr = new CheckpointManager({ verifyOnLoad: true });
        const ckpt = saveBasicCheckpoint(mgr);
        const result = mgr.load(ckpt.snapshot.id);
        expect(result.success).toBe(true);
    });

    it('should skip integrity check when policy disables it', () => {
        const mgr = new CheckpointManager({ verifyOnLoad: false });
        const ckpt = saveBasicCheckpoint(mgr);

        // Tamper with snapshot
        ckpt.snapshot.totalRetries = 999;

        // Should still load (no verification)
        const result = mgr.load(ckpt.snapshot.id);
        expect(result.success).toBe(true);
    });
});

// ─── CheckpointManager: Auto-Checkpoint & Pruning ───

describe('CheckpointManager - Auto-Checkpoint & Pruning', () => {
    it('should trigger auto-checkpoint after N completions', () => {
        const mgr = new CheckpointManager({ autoCheckpointInterval: 3 });

        expect(mgr.notifyTaskCompleted()).toBe(false); // 1
        expect(mgr.notifyTaskCompleted()).toBe(false); // 2
        expect(mgr.notifyTaskCompleted()).toBe(true);  // 3 → trigger
    });

    it('should reset counter after save', () => {
        const mgr = new CheckpointManager({ autoCheckpointInterval: 2 });

        mgr.notifyTaskCompleted(); // 1
        mgr.notifyTaskCompleted(); // 2 → trigger

        saveBasicCheckpoint(mgr); // resets counter

        expect(mgr.notifyTaskCompleted()).toBe(false); // 1 again
        expect(mgr.notifyTaskCompleted()).toBe(true);  // 2 → trigger
    });

    it('should not trigger when interval is 0 (disabled)', () => {
        const mgr = new CheckpointManager({ autoCheckpointInterval: 0 });
        for (let i = 0; i < 100; i++) {
            expect(mgr.notifyTaskCompleted()).toBe(false);
        }
    });

    it('should prune oldest checkpoints when maxCheckpoints exceeded', () => {
        const pruned: string[][] = [];
        const mgr = new CheckpointManager({ maxCheckpoints: 3 }, {
            onPruned: (ids) => pruned.push(ids),
        });

        const ids: string[] = [];
        for (let i = 0; i < 5; i++) {
            const ckpt = saveBasicCheckpoint(mgr, undefined, `ckpt-${i}`);
            ids.push(ckpt.snapshot.id);
        }

        expect(mgr.getCheckpointCount()).toBe(3);
        expect(mgr.listCheckpoints()).toHaveLength(3);

        // First two should have been pruned
        expect(mgr.getCheckpoint(ids[0])).toBeUndefined();
        expect(mgr.getCheckpoint(ids[1])).toBeUndefined();
        expect(mgr.getCheckpoint(ids[2])).toBeDefined();
    });
});

// ─── CheckpointManager: Callbacks ───

describe('CheckpointManager - Callbacks', () => {
    it('should fire onCheckpointSaved', () => {
        const saved: Checkpoint[] = [];
        const mgr = new CheckpointManager({}, { onCheckpointSaved: (c) => saved.push(c) });

        saveBasicCheckpoint(mgr);
        expect(saved).toHaveLength(1);
    });

    it('should fire onCheckpointLoaded', () => {
        const loaded: ExecutionSnapshot[] = [];
        const mgr = new CheckpointManager({}, { onCheckpointLoaded: (s) => loaded.push(s) });

        const ckpt = saveBasicCheckpoint(mgr);
        mgr.load(ckpt.snapshot.id);
        expect(loaded).toHaveLength(1);
    });

    it('should reset all state', () => {
        const mgr = new CheckpointManager();
        saveBasicCheckpoint(mgr);
        saveBasicCheckpoint(mgr);

        mgr.reset();
        expect(mgr.getCheckpointCount()).toBe(0);
        expect(mgr.listCheckpoints()).toHaveLength(0);
    });
});

// ─── ExecutionReplay ───

describe('ExecutionReplay', () => {
    it('should replay task lifecycle events', () => {
        const events: ReplayEvent[] = [];
        const replay = new ExecutionReplay({ onReplayEvent: (e) => events.push(e) });

        const snapshot: ExecutionSnapshot = {
            id: 'ckpt-1',
            version: 1,
            graph: {
                tasks: [
                    { id: 'a', type: 'PLAN', agent: 'architect', dependencies: [], payload: {}, status: 'COMPLETED', result: { exitCode: 0, stdout: 'done', stderr: '', durationMs: 100 }, retryCount: 0, depth: 0 },
                    { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: {}, status: 'FAILED', result: { exitCode: 1, stdout: '', stderr: 'compile error', durationMs: 200 }, retryCount: 1, depth: 0 },
                ],
            },
            executionOrder: ['a', 'b'],
            totalRetries: 1,
            totalSpawned: 0,
            outcomes: [],
            messages: [],
            createdAt: Date.now(),
            elapsedMs: 500,
        };

        const result = replay.replay(snapshot);

        // a: DISPATCH + COMPLETE, b: DISPATCH + FAIL = 4 events
        expect(result).toHaveLength(4);
        expect(result[0].type).toBe('DISPATCH');
        expect(result[0].taskId).toBe('a');
        expect(result[1].type).toBe('COMPLETE');
        expect(result[1].taskId).toBe('a');
        expect(result[2].type).toBe('DISPATCH');
        expect(result[2].taskId).toBe('b');
        expect(result[3].type).toBe('FAIL');
        expect(result[3].taskId).toBe('b');

        // Callback should have fired for each
        expect(events).toHaveLength(4);
    });

    it('should replay spawn events', () => {
        const replay = new ExecutionReplay();

        const snapshot: ExecutionSnapshot = {
            id: 'ckpt-1',
            version: 1,
            graph: {
                tasks: [
                    { id: 'root', type: 'PLAN', agent: 'architect', dependencies: [], payload: {}, status: 'COMPLETED', result: { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 50 }, retryCount: 0, depth: 0 },
                    { id: 'child', type: 'CODE', agent: 'builder', dependencies: ['root'], payload: {}, status: 'COMPLETED', result: { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 80 }, retryCount: 0, depth: 1, parentId: 'root' },
                ],
            },
            executionOrder: ['root', 'child'],
            totalRetries: 0,
            totalSpawned: 1,
            outcomes: [],
            messages: [],
            createdAt: Date.now(),
            elapsedMs: 200,
        };

        const result = replay.replay(snapshot);

        const spawnEvents = result.filter(e => e.type === 'SPAWN');
        expect(spawnEvents).toHaveLength(1);
        expect(spawnEvents[0].data.childId).toBe('child');
    });

    it('should replay messages', () => {
        const replay = new ExecutionReplay();

        const snapshot: ExecutionSnapshot = {
            id: 'ckpt-1',
            version: 1,
            graph: { tasks: [] },
            executionOrder: [],
            totalRetries: 0,
            totalSpawned: 0,
            outcomes: [],
            messages: [
                { id: 'msg-1', topic: 'task.completed', sender: 'a', senderRole: 'builder', payload: { x: 1 }, timestamp: Date.now(), ttlMs: 60000 },
                { id: 'msg-2', topic: 'agent.signal', sender: 'b', senderRole: 'architect', payload: { y: 2 }, timestamp: Date.now(), ttlMs: 60000 },
            ],
            createdAt: Date.now(),
            elapsedMs: 100,
        };

        const result = replay.replay(snapshot);
        const msgEvents = result.filter(e => e.type === 'MESSAGE');
        expect(msgEvents).toHaveLength(2);
    });

    it('should replay outcomes', () => {
        const replay = new ExecutionReplay();

        const snapshot: ExecutionSnapshot = {
            id: 'ckpt-1',
            version: 1,
            graph: { tasks: [] },
            executionOrder: [],
            totalRetries: 0,
            totalSpawned: 0,
            outcomes: [makeOutcome({ taskId: 'task-1' }), makeOutcome({ taskId: 'task-2', success: false, exitCode: 1 })],
            messages: [],
            createdAt: Date.now(),
            elapsedMs: 100,
        };

        const result = replay.replay(snapshot);
        const outcomeEvents = result.filter(e => e.type === 'OUTCOME');
        expect(outcomeEvents).toHaveLength(2);
        expect(outcomeEvents[0].taskId).toBe('task-1');
    });

    it('should assign sequential indices to events', () => {
        const replay = new ExecutionReplay();

        const snapshot: ExecutionSnapshot = {
            id: 'ckpt-1',
            version: 1,
            graph: {
                tasks: [
                    { id: 'a', type: 'CODE', agent: 'builder', dependencies: [], payload: {}, status: 'COMPLETED', result: { exitCode: 0, stdout: '', stderr: '', durationMs: 50 }, retryCount: 0, depth: 0 },
                ],
            },
            executionOrder: ['a'],
            totalRetries: 0,
            totalSpawned: 0,
            outcomes: [makeOutcome()],
            messages: [makeMessage()],
            createdAt: Date.now(),
            elapsedMs: 100,
        };

        const result = replay.replay(snapshot);
        for (let i = 0; i < result.length; i++) {
            expect(result[i].index).toBe(i);
        }
    });
});

// ─── ExecutionReplay: Summary ───

describe('ExecutionReplay - Summary', () => {
    it('should summarize a snapshot', () => {
        const replay = new ExecutionReplay();

        const snapshot: ExecutionSnapshot = {
            id: 'ckpt-1',
            version: 1,
            graph: {
                tasks: [
                    { id: 'a', type: 'PLAN', agent: 'architect', dependencies: [], payload: {}, status: 'COMPLETED', retryCount: 0, depth: 0, result: { exitCode: 0, stdout: '', stderr: '', durationMs: 50 } },
                    { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: {}, status: 'FAILED', retryCount: 2, depth: 0, result: { exitCode: 1, stdout: '', stderr: 'err', durationMs: 100 } },
                    { id: 'c', type: 'AUDIT', agent: 'guardian', dependencies: ['b'], payload: {}, status: 'SKIPPED', retryCount: 0, depth: 0 },
                ],
            },
            executionOrder: ['a', 'b'],
            totalRetries: 2,
            totalSpawned: 1,
            outcomes: [makeOutcome(), makeOutcome({ taskId: 't2' })],
            messages: [makeMessage()],
            createdAt: Date.now(),
            elapsedMs: 750,
        };

        const summary = replay.summarize(snapshot);
        expect(summary.totalTasks).toBe(3);
        expect(summary.completed).toBe(1);
        expect(summary.failed).toBe(1);
        expect(summary.skipped).toBe(1);
        expect(summary.spawned).toBe(1);
        expect(summary.messages).toBe(1);
        expect(summary.outcomes).toBe(2);
        expect(summary.elapsedMs).toBe(750);
    });
});
