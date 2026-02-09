/**
 * Distributed Execution Tests
 * 
 * Validates: worker registration, heartbeat monitoring, load balancing
 * strategies (round-robin, least-loaded, capability-match), failover,
 * dispatch routing, timeout handling, draining.
 * 
 * Phase 4.6: Distributed Execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    WorkerRegistry,
    LoadBalancer,
    DistributedDispatcher,
    WorkerNode,
    WorkerExecutor,
    FailoverEvent,
    DispatchResponse,
} from '../../src/orchestrator/distributed-executor';
import { DAGTask, DAGTaskResult } from '../../src/orchestrator/dag-engine';

// ─── Helpers ───

function makeTask(overrides: Partial<DAGTask> = {}): DAGTask {
    return {
        id: 'task-1',
        type: 'CODE',
        agent: 'builder',
        dependencies: [],
        payload: {},
        status: 'READY',
        retryCount: 0,
        depth: 0,
        ...overrides,
    };
}

function successExecutor(delayMs: number = 5): WorkerExecutor {
    return async (_workerId, task) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return { exitCode: 0, stdout: `Done: ${task.id}`, stderr: '', durationMs: delayMs };
    };
}

function failExecutor(error: string = 'WORKER_CRASH'): WorkerExecutor {
    return async () => {
        throw new Error(error);
    };
}

function selectiveExecutor(failWorkerIds: Set<string>, delayMs: number = 5): WorkerExecutor {
    return async (workerId, task) => {
        if (failWorkerIds.has(workerId)) {
            throw new Error(`WORKER_CRASH: ${workerId}`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return { exitCode: 0, stdout: `Done: ${task.id} on ${workerId}`, stderr: '', durationMs: delayMs };
    };
}

// ─── WorkerRegistry: Registration ───

describe('WorkerRegistry - Registration', () => {
    let registry: WorkerRegistry;

    beforeEach(() => {
        registry = new WorkerRegistry();
    });

    it('should register a worker', () => {
        const worker = registry.register('w1', ['CODE', 'TEST'], 3);

        expect(worker.id).toBe('w1');
        expect(worker.capabilities).toEqual(['CODE', 'TEST']);
        expect(worker.maxConcurrency).toBe(3);
        expect(worker.status).toBe('IDLE');
        expect(worker.activeTasks).toBe(0);
    });

    it('should retrieve a worker by ID', () => {
        registry.register('w1', ['CODE']);
        expect(registry.getWorker('w1')).toBeDefined();
        expect(registry.getWorker('fake')).toBeUndefined();
    });

    it('should deregister a worker', () => {
        registry.register('w1', ['CODE']);
        expect(registry.deregister('w1')).toBe(true);
        expect(registry.getWorker('w1')).toBeUndefined();
    });

    it('should count workers', () => {
        registry.register('w1', ['CODE']);
        registry.register('w2', ['AUDIT']);
        expect(registry.getWorkerCount()).toBe(2);
    });

    it('should fire onWorkerRegistered callback', () => {
        const registered: string[] = [];
        const reg = new WorkerRegistry({}, { onWorkerRegistered: (w) => registered.push(w.id) });
        reg.register('w1', ['CODE']);
        expect(registered).toEqual(['w1']);
    });

    it('should reset all state', () => {
        registry.register('w1', ['CODE']);
        registry.reset();
        expect(registry.getWorkerCount()).toBe(0);
    });
});

// ─── WorkerRegistry: Heartbeat ───

describe('WorkerRegistry - Heartbeat', () => {
    it('should record heartbeat', () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE']);

        const result = registry.heartbeat('w1');
        expect(result).toBe(true);
    });

    it('should return false for unknown worker', () => {
        const registry = new WorkerRegistry();
        expect(registry.heartbeat('fake')).toBe(false);
    });

    it('should mark workers DEAD after missed heartbeats', () => {
        const dead: string[] = [];
        const registry = new WorkerRegistry(
            { heartbeatIntervalMs: 10, missedHeartbeatsThreshold: 2 },
            { onWorkerDead: (w) => dead.push(w.id) },
        );

        // Register but set old heartbeat
        const worker = registry.register('w1', ['CODE']);
        worker.lastHeartbeat = Date.now() - 50; // 50ms ago, threshold = 20ms

        const newlyDead = registry.checkHeartbeats();
        expect(newlyDead).toHaveLength(1);
        expect(newlyDead[0].id).toBe('w1');
        expect(dead).toEqual(['w1']);
    });

    it('should NOT mark workers DEAD within threshold', () => {
        const registry = new WorkerRegistry(
            { heartbeatIntervalMs: 5000, missedHeartbeatsThreshold: 3 },
        );

        registry.register('w1', ['CODE']);
        // Heartbeat just happened on register

        const newlyDead = registry.checkHeartbeats();
        expect(newlyDead).toHaveLength(0);
    });

    it('should revive dead worker on heartbeat', () => {
        const registry = new WorkerRegistry({ heartbeatIntervalMs: 10, missedHeartbeatsThreshold: 1 });

        const worker = registry.register('w1', ['CODE']);
        worker.lastHeartbeat = Date.now() - 50;
        registry.checkHeartbeats();
        expect(registry.getWorker('w1')!.status).toBe('DEAD');

        registry.heartbeat('w1');
        expect(registry.getWorker('w1')!.status).toBe('IDLE');
    });
});

// ─── WorkerRegistry: Task Tracking ───

describe('WorkerRegistry - Task Tracking', () => {
    let registry: WorkerRegistry;

    beforeEach(() => {
        registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);
    });

    it('should track active tasks', () => {
        registry.taskStarted('w1');
        expect(registry.getWorker('w1')!.activeTasks).toBe(1);
        expect(registry.getWorker('w1')!.status).toBe('BUSY');
    });

    it('should transition to IDLE when all tasks complete', () => {
        registry.taskStarted('w1');
        registry.taskStarted('w1');
        registry.taskCompleted('w1');
        registry.taskCompleted('w1');

        expect(registry.getWorker('w1')!.activeTasks).toBe(0);
        expect(registry.getWorker('w1')!.status).toBe('IDLE');
    });

    it('should not go below 0 active tasks', () => {
        registry.taskCompleted('w1');
        expect(registry.getWorker('w1')!.activeTasks).toBe(0);
    });
});

// ─── WorkerRegistry: Draining ───

describe('WorkerRegistry - Draining', () => {
    it('should set worker to DRAINING', () => {
        const draining: string[] = [];
        const registry = new WorkerRegistry({}, { onWorkerDraining: (w) => draining.push(w.id) });
        registry.register('w1', ['CODE']);

        expect(registry.drain('w1')).toBe(true);
        expect(registry.getWorker('w1')!.status).toBe('DRAINING');
        expect(draining).toEqual(['w1']);
    });

    it('should not drain a DEAD worker', () => {
        const registry = new WorkerRegistry({ heartbeatIntervalMs: 1, missedHeartbeatsThreshold: 1 });
        const worker = registry.register('w1', ['CODE']);
        worker.lastHeartbeat = Date.now() - 100;
        registry.checkHeartbeats();

        expect(registry.drain('w1')).toBe(false);
    });

    it('should transition DRAINING → IDLE when tasks complete', () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE']);
        registry.taskStarted('w1');
        registry.drain('w1');
        expect(registry.getWorker('w1')!.status).toBe('DRAINING');

        registry.taskCompleted('w1');
        expect(registry.getWorker('w1')!.status).toBe('IDLE');
    });
});

// ─── WorkerRegistry: Queries ───

describe('WorkerRegistry - Queries', () => {
    let registry: WorkerRegistry;

    beforeEach(() => {
        registry = new WorkerRegistry();
        registry.register('w1', ['CODE', 'TEST'], 3);
        registry.register('w2', ['AUDIT', 'PLAN'], 2);
        registry.register('w3', ['CODE', 'AUDIT'], 5);
    });

    it('should get workers by status', () => {
        expect(registry.getWorkersByStatus('IDLE')).toHaveLength(3);
        registry.taskStarted('w1');
        expect(registry.getWorkersByStatus('BUSY')).toHaveLength(1);
    });

    it('should get available workers (with capacity)', () => {
        // w2 has max 2, fill it up
        registry.taskStarted('w2');
        registry.taskStarted('w2');

        const available = registry.getAvailableWorkers();
        expect(available).toHaveLength(2); // w1 and w3 still available
    });

    it('should get capable workers for a task type', () => {
        const codeWorkers = registry.getCapableWorkers('CODE');
        expect(codeWorkers).toHaveLength(2); // w1 and w3

        const auditWorkers = registry.getCapableWorkers('AUDIT');
        expect(auditWorkers).toHaveLength(2); // w2 and w3
    });

    it('should exclude DRAINING workers from available', () => {
        registry.drain('w1');
        const available = registry.getAvailableWorkers();
        expect(available.map(w => w.id)).not.toContain('w1');
    });

    it('should get all workers', () => {
        expect(registry.getAllWorkers()).toHaveLength(3);
    });
});

// ─── LoadBalancer ───

describe('LoadBalancer', () => {
    it('should round-robin through candidates', () => {
        const lb = new LoadBalancer('ROUND_ROBIN');
        const workers: WorkerNode[] = [
            { id: 'w1', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
            { id: 'w2', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
            { id: 'w3', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
        ];

        expect(lb.select(workers)!.id).toBe('w1');
        expect(lb.select(workers)!.id).toBe('w2');
        expect(lb.select(workers)!.id).toBe('w3');
        expect(lb.select(workers)!.id).toBe('w1'); // wraps around
    });

    it('should select least-loaded worker', () => {
        const lb = new LoadBalancer('LEAST_LOADED');
        const workers: WorkerNode[] = [
            { id: 'w1', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 2, status: 'BUSY', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
            { id: 'w2', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
            { id: 'w3', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 1, status: 'BUSY', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
        ];

        expect(lb.select(workers)!.id).toBe('w2'); // 0 tasks
    });

    it('should capability-match then pick least-loaded', () => {
        const lb = new LoadBalancer('CAPABILITY_MATCH');
        const workers: WorkerNode[] = [
            { id: 'w1', capabilities: ['AUDIT'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
            { id: 'w2', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 1, status: 'BUSY', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
            { id: 'w3', capabilities: ['CODE'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
        ];

        const selected = lb.select(workers, 'CODE');
        expect(selected!.id).toBe('w3'); // capable + least loaded
    });

    it('should return undefined for no capable workers', () => {
        const lb = new LoadBalancer('CAPABILITY_MATCH');
        const workers: WorkerNode[] = [
            { id: 'w1', capabilities: ['AUDIT'], maxConcurrency: 3, activeTasks: 0, status: 'IDLE', lastHeartbeat: Date.now(), registeredAt: Date.now(), metadata: {} },
        ];

        expect(lb.select(workers, 'CODE')).toBeUndefined();
    });

    it('should return undefined for empty candidates', () => {
        const lb = new LoadBalancer('ROUND_ROBIN');
        expect(lb.select([])).toBeUndefined();
    });

    it('should allow strategy change at runtime', () => {
        const lb = new LoadBalancer('ROUND_ROBIN');
        expect(lb.getStrategy()).toBe('ROUND_ROBIN');

        lb.setStrategy('LEAST_LOADED');
        expect(lb.getStrategy()).toBe('LEAST_LOADED');
    });
});

// ─── DistributedDispatcher: Basic Dispatch ───

describe('DistributedDispatcher - Basic Dispatch', () => {
    let registry: WorkerRegistry;

    beforeEach(() => {
        registry = new WorkerRegistry();
        registry.register('w1', ['CODE', 'PLAN'], 3);
        registry.register('w2', ['CODE', 'AUDIT'], 3);
    });

    it('should dispatch to an available worker', async () => {
        const dispatcher = new DistributedDispatcher(registry, successExecutor());
        const task = makeTask();

        const response = await dispatcher.dispatch(task);
        expect(response).not.toBeNull();
        expect(response!.taskId).toBe('task-1');
        expect(response!.result.exitCode).toBe(0);
        expect(response!.failover).toBe(false);
    });

    it('should return null when no workers available', async () => {
        const emptyRegistry = new WorkerRegistry();
        const dispatcher = new DistributedDispatcher(emptyRegistry, successExecutor());

        const response = await dispatcher.dispatch(makeTask());
        expect(response).toBeNull();
    });

    it('should return null when no capable workers', async () => {
        const reg = new WorkerRegistry();
        reg.register('w1', ['AUDIT'], 3); // Only AUDIT, not CODE

        const dispatcher = new DistributedDispatcher(reg, successExecutor());
        const response = await dispatcher.dispatch(makeTask({ type: 'CODE' }));
        expect(response).toBeNull();
    });

    it('should fire onDispatch and onDispatchComplete callbacks', async () => {
        const dispatched: { taskId: string; workerId: string }[] = [];
        const completed: DispatchResponse[] = [];

        const dispatcher = new DistributedDispatcher(registry, successExecutor(), {}, {
            onDispatch: (taskId, workerId) => dispatched.push({ taskId, workerId }),
            onDispatchComplete: (r) => completed.push(r),
        });

        await dispatcher.dispatch(makeTask());

        expect(dispatched).toHaveLength(1);
        expect(completed).toHaveLength(1);
    });
});

// ─── DistributedDispatcher: Failover ───

describe('DistributedDispatcher - Failover', () => {
    it('should failover to another worker on crash', async () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);
        registry.register('w2', ['CODE'], 3);

        const failovers: FailoverEvent[] = [];

        const dispatcher = new DistributedDispatcher(
            registry,
            selectiveExecutor(new Set(['w1'])), // w1 crashes
            { maxFailoverAttempts: 2, strategy: 'ROUND_ROBIN' },
            { onFailover: (e) => failovers.push(e) },
        );

        const response = await dispatcher.dispatch(makeTask());

        expect(response).not.toBeNull();
        expect(response!.failover).toBe(true);
        expect(response!.failoverAttempts).toBe(1);
        expect(response!.workerId).toBe('w2');
        expect(failovers).toHaveLength(1);
    });

    it('should return null after exhausting all failover attempts', async () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);

        const dispatcher = new DistributedDispatcher(
            registry,
            failExecutor(),
            { maxFailoverAttempts: 2 },
        );

        const response = await dispatcher.dispatch(makeTask());
        expect(response).toBeNull();
    });

    it('should track failover events in log', async () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);
        registry.register('w2', ['CODE'], 3);

        const dispatcher = new DistributedDispatcher(
            registry,
            selectiveExecutor(new Set(['w1'])),
            { maxFailoverAttempts: 2, strategy: 'ROUND_ROBIN' },
        );

        await dispatcher.dispatch(makeTask());

        const log = dispatcher.getFailoverLog();
        expect(log).toHaveLength(1);
        expect(log[0].fromWorkerId).toBe('w1');
        expect(log[0].reason).toContain('WORKER_CRASH');
    });

    it('should exclude failed workers from subsequent attempts', async () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);
        registry.register('w2', ['CODE'], 3);
        registry.register('w3', ['CODE'], 3);

        // w1 and w2 crash, w3 succeeds
        const dispatcher = new DistributedDispatcher(
            registry,
            selectiveExecutor(new Set(['w1', 'w2'])),
            { maxFailoverAttempts: 2, strategy: 'ROUND_ROBIN' },
        );

        const response = await dispatcher.dispatch(makeTask());
        expect(response).not.toBeNull();
        expect(response!.workerId).toBe('w3');
        expect(response!.failoverAttempts).toBe(2);
    });
});

// ─── DistributedDispatcher: Timeout ───

describe('DistributedDispatcher - Timeout', () => {
    it('should timeout slow workers and failover', async () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);
        registry.register('w2', ['CODE'], 3);

        // w1 is very slow (200ms), timeout is 50ms
        const slowThenFast: WorkerExecutor = async (workerId, task) => {
            const delay = workerId === 'w1' ? 200 : 5;
            await new Promise(resolve => setTimeout(resolve, delay));
            return { exitCode: 0, stdout: `Done on ${workerId}`, stderr: '', durationMs: delay };
        };

        const dispatcher = new DistributedDispatcher(
            registry,
            slowThenFast,
            { defaultDispatchTimeoutMs: 50, maxFailoverAttempts: 2, strategy: 'ROUND_ROBIN' },
        );

        const response = await dispatcher.dispatch(makeTask());
        expect(response).not.toBeNull();
        expect(response!.workerId).toBe('w2');
        expect(response!.failover).toBe(true);
    });
});

// ─── Integration: Worker Lifecycle ───

describe('Integration - Worker Lifecycle', () => {
    it('should handle register → dispatch → complete → idle cycle', async () => {
        const registry = new WorkerRegistry();
        const worker = registry.register('w1', ['CODE'], 1);

        expect(worker.status).toBe('IDLE');

        const dispatcher = new DistributedDispatcher(registry, successExecutor(10));
        const response = await dispatcher.dispatch(makeTask());

        expect(response).not.toBeNull();
        expect(registry.getWorker('w1')!.status).toBe('IDLE');
        expect(registry.getWorker('w1')!.activeTasks).toBe(0);
    });

    it('should not dispatch to draining workers', async () => {
        const registry = new WorkerRegistry();
        registry.register('w1', ['CODE'], 3);
        registry.register('w2', ['CODE'], 3);
        registry.drain('w1');

        const dispatcher = new DistributedDispatcher(registry, successExecutor());
        const response = await dispatcher.dispatch(makeTask());

        expect(response).not.toBeNull();
        expect(response!.workerId).toBe('w2');
    });
});
