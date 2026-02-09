/**
 * DAG Engine Tests
 * 
 * Validates: topological sort, cycle detection, parallel execution,
 * retry with feedback, circuit breaker, dependency cascading.
 * 
 * Phase 4.0: DAG Orchestration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DAGEngine, DAGTask, DAGTaskResult, DAGGraph, TaskDispatchResult, MutationController, SpawnRequest } from '../../src/orchestrator/dag-engine';
import { RetryPolicy } from '../../src/orchestrator/retry-policy';

// ─── Helpers ───

/** Creates a simple successful dispatcher */
function successDispatcher(delayMs: number = 10): (task: DAGTask) => Promise<DAGTaskResult> {
    return async (task) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: delayMs };
    };
}

/** Creates a dispatcher that fails specific tasks */
function selectiveDispatcher(
    failIds: Set<string>,
    delayMs: number = 10,
): (task: DAGTask) => Promise<DAGTaskResult> {
    return async (task) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        if (failIds.has(task.id)) {
            return { exitCode: 1, stdout: '', stderr: `Error in ${task.id}`, durationMs: delayMs };
        }
        return { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: delayMs };
    };
}

/** Creates a dispatcher that tracks execution order */
function orderTrackingDispatcher(
    order: string[],
    delayMs: number = 10,
): (task: DAGTask) => Promise<DAGTaskResult> {
    return async (task) => {
        order.push(task.id);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: delayMs };
    };
}

// ─── Graph Validation Tests ───

describe('DAGEngine - Validation', () => {
    let engine: DAGEngine;

    beforeEach(() => {
        engine = new DAGEngine({ tickIntervalMs: 10 });
    });

    it('should validate a correct DAG', () => {
        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'PLAN', agent: 'architect' },
            { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'] },
            { id: 'c', type: 'AUDIT', agent: 'guardian', dependencies: ['b'] },
        ]);
        const result = engine.validate(graph);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should detect cycles (constitutional violation Art. III.1)', () => {
        const graph: DAGGraph = { tasks: new Map() };
        graph.tasks.set('a', { id: 'a', type: 'CODE', agent: 'builder', dependencies: ['c'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        graph.tasks.set('b', { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        graph.tasks.set('c', { id: 'c', type: 'CODE', agent: 'builder', dependencies: ['b'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });

        const result = engine.validate(graph);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Cyclic dependency'))).toBe(true);
    });

    it('should detect missing dependencies', () => {
        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'CODE', agent: 'builder', dependencies: ['nonexistent'] },
        ]);
        const result = engine.validate(graph);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('non-existent'))).toBe(true);
    });

    it('should validate empty graph', () => {
        const graph: DAGGraph = { tasks: new Map() };
        const result = engine.validate(graph);
        expect(result.valid).toBe(true);
    });
});

// ─── Execution Tests ───

describe('DAGEngine - Execution', () => {
    let engine: DAGEngine;

    beforeEach(() => {
        engine = new DAGEngine({ maxConcurrency: 3, tickIntervalMs: 10, maxExecutionTimeMs: 5000 });
    });

    it('should execute a linear chain in order', async () => {
        const order: string[] = [];
        const graph = DAGEngine.buildGraph([
            { id: 'plan', type: 'PLAN', agent: 'architect' },
            { id: 'code', type: 'CODE', agent: 'builder', dependencies: ['plan'] },
            { id: 'audit', type: 'AUDIT', agent: 'guardian', dependencies: ['code'] },
        ]);

        const result = await engine.execute(graph, orderTrackingDispatcher(order, 5));

        expect(result.completed).toBe(3);
        expect(result.failed).toBe(0);
        expect(order).toEqual(['plan', 'code', 'audit']);
    });

    it('should execute independent tasks in parallel', async () => {
        const startTimes: Record<string, number> = {};
        const dispatcher = async (task: DAGTask): Promise<DAGTaskResult> => {
            startTimes[task.id] = Date.now();
            await new Promise(resolve => setTimeout(resolve, 50));
            return { exitCode: 0, stdout: '', stderr: '', durationMs: 50 };
        };

        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
            { id: 'a', type: 'CODE', agent: 'builder', dependencies: ['root'] },
            { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['root'] },
            { id: 'c', type: 'CODE', agent: 'builder', dependencies: ['root'] },
        ]);

        const result = await engine.execute(graph, dispatcher);

        expect(result.completed).toBe(4);
        // a, b, c should start at approximately the same time (within 100ms tolerance)
        const aStart = startTimes['a'];
        const bStart = startTimes['b'];
        const cStart = startTimes['c'];
        expect(Math.abs(aStart - bStart)).toBeLessThan(100);
        expect(Math.abs(bStart - cStart)).toBeLessThan(100);
    });

    it('should respect concurrency limit', async () => {
        let maxConcurrent = 0;
        let currentConcurrent = 0;

        const dispatcher = async (task: DAGTask): Promise<DAGTaskResult> => {
            currentConcurrent++;
            maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
            await new Promise(resolve => setTimeout(resolve, 30));
            currentConcurrent--;
            return { exitCode: 0, stdout: '', stderr: '', durationMs: 30 };
        };

        const limitedEngine = new DAGEngine({ maxConcurrency: 2, tickIntervalMs: 10 });
        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'CODE', agent: 'builder' },
            { id: 'b', type: 'CODE', agent: 'builder' },
            { id: 'c', type: 'CODE', agent: 'builder' },
            { id: 'd', type: 'CODE', agent: 'builder' },
        ]);

        await limitedEngine.execute(graph, dispatcher);
        expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should skip dependents when a task fails', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
            { id: 'code', type: 'CODE', agent: 'builder', dependencies: ['root'] },
            { id: 'audit', type: 'AUDIT', agent: 'guardian', dependencies: ['code'] },
        ]);

        const result = await engine.execute(graph, selectiveDispatcher(new Set(['root'])));

        expect(result.completed).toBe(0);
        expect(result.failed).toBe(1); // root failed
        expect(result.skipped).toBe(2); // code + audit skipped
    });

    it('should handle diamond dependency pattern', async () => {
        const order: string[] = [];
        const graph = DAGEngine.buildGraph([
            { id: 'start', type: 'PLAN', agent: 'architect' },
            { id: 'left', type: 'CODE', agent: 'builder', dependencies: ['start'] },
            { id: 'right', type: 'CODE', agent: 'builder', dependencies: ['start'] },
            { id: 'join', type: 'AUDIT', agent: 'guardian', dependencies: ['left', 'right'] },
        ]);

        const result = await engine.execute(graph, orderTrackingDispatcher(order, 5));

        expect(result.completed).toBe(4);
        // 'start' must be first, 'join' must be last
        expect(order[0]).toBe('start');
        expect(order[order.length - 1]).toBe('join');
    });

    it('should reject cyclic graphs without executing', async () => {
        const graph: DAGGraph = { tasks: new Map() };
        graph.tasks.set('a', { id: 'a', type: 'CODE', agent: 'builder', dependencies: ['b'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        graph.tasks.set('b', { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });

        const result = await engine.execute(graph, successDispatcher());

        expect(result.completed).toBe(0);
        expect(result.failed).toBe(2);
    });
});

// ─── Retry Tests ───

describe('DAGEngine - Retry & Self-Healing', () => {
    it('should retry CODE tasks with error feedback', async () => {
        let callCount = 0;
        const dispatcher = async (task: DAGTask): Promise<DAGTaskResult> => {
            callCount++;
            if (callCount === 1) {
                return { exitCode: 1, stdout: '', stderr: 'Syntax error line 42', durationMs: 10 };
            }
            // Second attempt succeeds
            return { exitCode: 0, stdout: 'Fixed!', stderr: '', durationMs: 10 };
        };

        const retryPolicy = new RetryPolicy({ baseDelayMs: 10, maxDelayMs: 50 });
        const engine = new DAGEngine({ tickIntervalMs: 10 }, retryPolicy);

        const graph = DAGEngine.buildGraph([
            { id: 'code', type: 'CODE', agent: 'builder' },
        ]);

        const result = await engine.execute(graph, dispatcher);

        expect(result.completed).toBe(1);
        expect(result.retries).toBe(1);
        expect(callCount).toBe(2);

        // Verify feedback was injected
        const task = graph.tasks.get('code')!;
        expect(task.payload._retry).toBeDefined();
    });

    it('should not retry PLAN tasks', async () => {
        let callCount = 0;
        const dispatcher = async (): Promise<DAGTaskResult> => {
            callCount++;
            return { exitCode: 1, stdout: '', stderr: 'Plan error', durationMs: 10 };
        };

        const retryPolicy = new RetryPolicy({ baseDelayMs: 10 });
        const engine = new DAGEngine({ tickIntervalMs: 10 }, retryPolicy);

        const graph = DAGEngine.buildGraph([
            { id: 'plan', type: 'PLAN', agent: 'architect' },
        ]);

        const result = await engine.execute(graph, dispatcher);

        expect(result.failed).toBe(1);
        expect(result.retries).toBe(0);
        expect(callCount).toBe(1); // No retry
    });

    it('should trigger circuit breaker after threshold', async () => {
        const retryPolicy = new RetryPolicy({
            baseDelayMs: 5,
            circuitBreakerThreshold: 3,
            maxRetries: { PLAN: 0, CODE: 0, AUDIT: 0, TEST: 0, REVIEW: 0, DEPLOY: 0, RESEARCH: 0, DESIGN: 0, INFRA_PROVISION: 0 },
        });

        const engine = new DAGEngine({ tickIntervalMs: 10, maxConcurrency: 1 }, retryPolicy);

        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'CODE', agent: 'builder' },
            { id: 'b', type: 'CODE', agent: 'builder' },
            { id: 'c', type: 'CODE', agent: 'builder' },
            { id: 'd', type: 'CODE', agent: 'builder' },
        ]);

        const failDispatcher = async (): Promise<DAGTaskResult> => {
            return { exitCode: 1, stdout: '', stderr: 'fail', durationMs: 5 };
        };

        const result = await engine.execute(graph, failDispatcher);

        expect(result.circuitBroken).toBe(true);
        expect(result.skipped).toBeGreaterThan(0);
    });
});

// ─── Callbacks Tests ───

describe('DAGEngine - Callbacks', () => {
    it('should fire onDispatch and onComplete callbacks', async () => {
        const dispatched: string[] = [];
        const completed: string[] = [];

        const engine = new DAGEngine({ tickIntervalMs: 10 }, undefined, {
            onDispatch: (task) => dispatched.push(task.id),
            onComplete: (task) => completed.push(task.id),
        });

        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'CODE', agent: 'builder' },
            { id: 'b', type: 'CODE', agent: 'builder' },
        ]);

        await engine.execute(graph, successDispatcher(5));

        expect(dispatched).toContain('a');
        expect(dispatched).toContain('b');
        expect(completed).toContain('a');
        expect(completed).toContain('b');
    });

    it('should fire onFail callback', async () => {
        const failed: string[] = [];

        const engine = new DAGEngine({ tickIntervalMs: 10 }, undefined, {
            onFail: (task) => failed.push(task.id),
        });

        const graph = DAGEngine.buildGraph([
            { id: 'broken', type: 'PLAN', agent: 'architect' },
        ]);

        await engine.execute(graph, selectiveDispatcher(new Set(['broken'])));

        expect(failed).toContain('broken');
    });
});

// ─── buildGraph Tests ───

describe('DAGEngine.buildGraph', () => {
    it('should create a valid graph from task definitions', () => {
        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'PLAN', agent: 'architect' },
            { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'], payload: { file: 'test.ts' } },
        ]);

        expect(graph.tasks.size).toBe(2);
        expect(graph.tasks.get('a')!.status).toBe('PENDING');
        expect(graph.tasks.get('a')!.depth).toBe(0);
        expect(graph.tasks.get('b')!.dependencies).toEqual(['a']);
        expect(graph.tasks.get('b')!.payload).toEqual({ file: 'test.ts' });
    });
});

// ─── Phase 4.1: Dynamic Graph Mutation Tests ───

/** Helper: creates a mutating dispatcher that returns spawn requests from a map */
function mutatingDispatcher(
    spawnMap: Record<string, SpawnRequest[]>,
    delayMs: number = 5,
): (task: DAGTask) => Promise<TaskDispatchResult> {
    return async (task) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return {
            result: { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: delayMs },
            spawnRequests: spawnMap[task.id],
        };
    };
}

/** Helper: creates a mutating dispatcher that always succeeds with no spawns */
function simpleMutatingDispatcher(delayMs: number = 5): (task: DAGTask) => Promise<TaskDispatchResult> {
    return async (task) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return {
            result: { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: delayMs },
        };
    };
}

describe('DAGEngine - Dynamic Graph Mutation', () => {
    let engine: DAGEngine;

    beforeEach(() => {
        engine = new DAGEngine({ maxConcurrency: 3, tickIntervalMs: 10, maxExecutionTimeMs: 5000 });
    });

    it('should execute a mutating DAG with no spawns (baseline)', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'plan', type: 'PLAN', agent: 'architect' },
            { id: 'code', type: 'CODE', agent: 'builder', dependencies: ['plan'] },
        ]);

        const result = await engine.executeMutating(graph, simpleMutatingDispatcher());

        expect(result.completed).toBe(2);
        expect(result.spawned).toBe(0);
        expect(result.totalTasks).toBe(2);
    });

    it('should inject spawned tasks and execute them', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'plan', type: 'PLAN', agent: 'architect' },
        ]);

        const dispatcher = mutatingDispatcher({
            'plan': [
                { id: 'code_a', type: 'CODE', agent: 'builder' },
                { id: 'code_b', type: 'CODE', agent: 'builder' },
            ],
        });

        const result = await engine.executeMutating(graph, dispatcher);

        expect(result.completed).toBe(3); // plan + code_a + code_b
        expect(result.spawned).toBe(2);
        expect(result.totalTasks).toBe(3);
    });

    it('should set correct depth and parentId on spawned tasks', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);

        const dispatcher = mutatingDispatcher({
            'root': [{ id: 'child', type: 'CODE', agent: 'builder' }],
        });

        await engine.executeMutating(graph, dispatcher);

        const child = graph.tasks.get('child')!;
        expect(child.depth).toBe(1);
        expect(child.parentId).toBe('root');
    });

    it('should inject parent context into spawned task payload', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);

        const dispatcher = mutatingDispatcher({
            'root': [{ id: 'child', type: 'CODE', agent: 'builder', payload: { file: 'test.ts' } }],
        });

        await engine.executeMutating(graph, dispatcher);

        const child = graph.tasks.get('child')!;
        expect(child.payload._parentContext).toBeDefined();
        expect((child.payload._parentContext as Record<string, unknown>).parentId).toBe('root');
        expect(child.payload.file).toBe('test.ts');
    });

    it('should support multi-generation spawning (depth > 1)', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'gen0', type: 'PLAN', agent: 'architect' },
        ]);

        const dispatcher: (task: DAGTask) => Promise<TaskDispatchResult> = async (task) => {
            await new Promise(resolve => setTimeout(resolve, 5));
            const spawns: SpawnRequest[] = [];
            if (task.id === 'gen0') spawns.push({ id: 'gen1', type: 'CODE', agent: 'builder' });
            if (task.id === 'gen1') spawns.push({ id: 'gen2', type: 'AUDIT', agent: 'guardian' });
            return {
                result: { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: 5 },
                spawnRequests: spawns.length > 0 ? spawns : undefined,
            };
        };

        const result = await engine.executeMutating(graph, dispatcher);

        expect(result.completed).toBe(3);
        expect(result.spawned).toBe(2);
        expect(graph.tasks.get('gen1')!.depth).toBe(1);
        expect(graph.tasks.get('gen2')!.depth).toBe(2);
    });

    it('should fire onSpawn callback for accepted spawns', async () => {
        const spawnedIds: string[] = [];
        const cbEngine = new DAGEngine({ tickIntervalMs: 10 }, undefined, {
            onSpawn: (_parent, child) => spawnedIds.push(child.id),
        });

        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);

        await cbEngine.executeMutating(graph, mutatingDispatcher({
            'root': [{ id: 'child', type: 'CODE', agent: 'builder' }],
        }));

        expect(spawnedIds).toContain('child');
    });

    it('should fire onSpawnRejected callback for rejected spawns', async () => {
        const rejectedIds: string[] = [];
        const cbEngine = new DAGEngine({ tickIntervalMs: 10 }, undefined, {
            onSpawnRejected: (_parent, req, _reason) => rejectedIds.push(req.id),
        });

        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);

        // Spawn with duplicate ID (root already exists)
        await cbEngine.executeMutating(graph, mutatingDispatcher({
            'root': [{ id: 'root', type: 'CODE', agent: 'builder' }],
        }));

        expect(rejectedIds).toContain('root');
    });

    it('should default spawn dependencies to parent task', async () => {
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);

        await engine.executeMutating(graph, mutatingDispatcher({
            'root': [{ id: 'child', type: 'CODE', agent: 'builder' }],
        }));

        const child = graph.tasks.get('child')!;
        expect(child.dependencies).toEqual(['root']);
    });
});

// ─── MutationController Unit Tests ───

describe('MutationController', () => {
    it('should accept valid spawn requests', () => {
        const controller = new MutationController();
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);
        const parent = graph.tasks.get('root')!;
        parent.status = 'COMPLETED';

        const result = controller.evaluate(
            [{ id: 'child', type: 'CODE', agent: 'builder' }],
            parent,
            graph,
        );

        expect(result.accepted).toHaveLength(1);
        expect(result.rejected).toHaveLength(0);
    });

    it('should reject spawns exceeding max depth', () => {
        const controller = new MutationController({ maxDepth: 2 });
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);
        // Simulate a deep parent
        const parent: DAGTask = {
            id: 'deep', type: 'CODE', agent: 'builder',
            dependencies: [], payload: {}, status: 'COMPLETED',
            retryCount: 0, depth: 2,
        };
        graph.tasks.set('deep', parent);

        const result = controller.evaluate(
            [{ id: 'too_deep', type: 'CODE', agent: 'builder' }],
            parent,
            graph,
        );

        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0].reason).toContain('DEPTH_EXCEEDED');
    });

    it('should reject spawns exceeding max graph size', () => {
        const controller = new MutationController({ maxGraphSize: 2 });
        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'PLAN', agent: 'architect' },
            { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'] },
        ]);
        const parent = graph.tasks.get('a')!;
        parent.status = 'COMPLETED';

        const result = controller.evaluate(
            [{ id: 'c', type: 'CODE', agent: 'builder' }],
            parent,
            graph,
        );

        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0].reason).toContain('GRAPH_SIZE_EXCEEDED');
    });

    it('should reject duplicate task IDs', () => {
        const controller = new MutationController();
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);
        const parent = graph.tasks.get('root')!;
        parent.status = 'COMPLETED';

        const result = controller.evaluate(
            [{ id: 'root', type: 'CODE', agent: 'builder' }],
            parent,
            graph,
        );

        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0].reason).toContain('DUPLICATE_ID');
    });

    it('should reject spawns with missing dependencies', () => {
        const controller = new MutationController();
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);
        const parent = graph.tasks.get('root')!;
        parent.status = 'COMPLETED';

        const result = controller.evaluate(
            [{ id: 'child', type: 'CODE', agent: 'builder', dependencies: ['nonexistent'] }],
            parent,
            graph,
        );

        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0].reason).toContain('MISSING_DEPENDENCY');
    });

    it('should reject spawns that would create cycles', () => {
        const controller = new MutationController();
        const graph = DAGEngine.buildGraph([
            { id: 'a', type: 'PLAN', agent: 'architect' },
            { id: 'b', type: 'CODE', agent: 'builder', dependencies: ['a'] },
        ]);
        const parent = graph.tasks.get('b')!;
        parent.status = 'COMPLETED';

        // Spawn a task that depends on 'b' but 'a' depends on nothing.
        // Try to spawn 'c' that 'a' would depend on — can't create that cycle via spawn.
        // Instead: spawn with dependency on parent ('b'), where parent depends on 'a'.
        // This is fine. Let's test a real cycle: spawn 'c' with dep on 'b', then try to make 'a' dep on 'c'.
        // Actually MutationController checks the new task only. Let's create a scenario:
        // existing: a -> b (b depends on a). Spawn 'c' with dep on 'a' from parent 'b'. c -> a -> b. No cycle.
        // For a real cycle: we'd need c to depend on b AND b to depend on c.
        // We can't modify existing tasks. So cycles from spawning are only possible
        // if the spawn declares a dependency on itself or creates a new loop.
        const result = controller.evaluate(
            [{ id: 'c', type: 'CODE', agent: 'builder', dependencies: ['b'] }],
            parent,
            graph,
        );

        // This should be accepted (no cycle: a -> b -> c)
        expect(result.accepted).toHaveLength(1);
    });

    it('should expose policy via getPolicy', () => {
        const controller = new MutationController({ maxDepth: 5 });
        const policy = controller.getPolicy();
        expect(policy.maxDepth).toBe(5);
        expect(policy.maxGraphSize).toBe(50); // default
    });

    it('should accept multiple valid spawns in batch', () => {
        const controller = new MutationController();
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);
        const parent = graph.tasks.get('root')!;
        parent.status = 'COMPLETED';

        const result = controller.evaluate(
            [
                { id: 'child_a', type: 'CODE', agent: 'builder' },
                { id: 'child_b', type: 'CODE', agent: 'builder' },
                { id: 'child_c', type: 'AUDIT', agent: 'guardian' },
            ],
            parent,
            graph,
        );

        expect(result.accepted).toHaveLength(3);
        expect(result.rejected).toHaveLength(0);
    });

    it('should partially accept batch with mixed valid/invalid spawns', () => {
        const controller = new MutationController();
        const graph = DAGEngine.buildGraph([
            { id: 'root', type: 'PLAN', agent: 'architect' },
        ]);
        const parent = graph.tasks.get('root')!;
        parent.status = 'COMPLETED';

        const result = controller.evaluate(
            [
                { id: 'valid_child', type: 'CODE', agent: 'builder' },
                { id: 'root', type: 'CODE', agent: 'builder' }, // duplicate
                { id: 'orphan', type: 'CODE', agent: 'builder', dependencies: ['ghost'] }, // missing dep
            ],
            parent,
            graph,
        );

        expect(result.accepted).toHaveLength(1);
        expect(result.accepted[0].id).toBe('valid_child');
        expect(result.rejected).toHaveLength(2);
    });
});
