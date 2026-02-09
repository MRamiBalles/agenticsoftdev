/**
 * Distributed Execution: Worker Registry, Load Balancing & Failover
 * 
 * Extends the DAG engine to dispatch tasks across multiple worker nodes:
 *   - Worker registration with capability declaration
 *   - Heartbeat monitoring with configurable timeout
 *   - 3 load balancing strategies: ROUND_ROBIN, LEAST_LOADED, CAPABILITY_MATCH
 *   - Automatic failover on worker death or dispatch timeout
 *   - Forensic logging of all failover events
 * 
 * Phase 4.6: Distributed Execution
 * Compliance: constitution.md Art. I (Human Authority — worker state observable),
 *             Art. V (Structural Integrity — failover prevents data loss)
 */

import { TaskType } from './retry-policy';
import { DAGTask, DAGTaskResult } from './dag-engine';

// ─── Types ───

export type WorkerStatus = 'IDLE' | 'BUSY' | 'DRAINING' | 'DEAD';

export type LoadBalancingStrategy = 'ROUND_ROBIN' | 'LEAST_LOADED' | 'CAPABILITY_MATCH';

/** A registered worker node */
export interface WorkerNode {
    id: string;
    /** Task types this worker can handle */
    capabilities: TaskType[];
    /** Maximum concurrent tasks */
    maxConcurrency: number;
    /** Current active task count */
    activeTasks: number;
    /** Current status */
    status: WorkerStatus;
    /** Last heartbeat timestamp */
    lastHeartbeat: number;
    /** Registration timestamp */
    registeredAt: number;
    /** Worker metadata (e.g., host, region) */
    metadata: Record<string, unknown>;
}

/** Request to dispatch a task to a worker */
export interface DispatchRequest {
    taskId: string;
    task: DAGTask;
    /** Timeout for this dispatch (ms) */
    timeoutMs: number;
}

/** Response from a worker after task execution */
export interface DispatchResponse {
    taskId: string;
    workerId: string;
    result: DAGTaskResult;
    /** Whether this was a failover dispatch */
    failover: boolean;
    /** Number of failover attempts before success */
    failoverAttempts: number;
}

/** Configuration for the distributed executor */
export interface DistributedConfig {
    /** Heartbeat interval expected from workers (ms) */
    heartbeatIntervalMs: number;
    /** Number of missed heartbeats before DEAD (default: 3) */
    missedHeartbeatsThreshold: number;
    /** Default dispatch timeout (ms) */
    defaultDispatchTimeoutMs: number;
    /** Max failover attempts per task */
    maxFailoverAttempts: number;
    /** Load balancing strategy */
    strategy: LoadBalancingStrategy;
}

/** Failover event for forensic logging */
export interface FailoverEvent {
    taskId: string;
    fromWorkerId: string;
    toWorkerId: string;
    reason: string;
    attempt: number;
    timestamp: number;
}

/** Callbacks for distributed execution observability */
export interface DistributedCallbacks {
    onWorkerRegistered?: (worker: WorkerNode) => void;
    onWorkerDead?: (worker: WorkerNode) => void;
    onWorkerDraining?: (worker: WorkerNode) => void;
    onDispatch?: (taskId: string, workerId: string) => void;
    onFailover?: (event: FailoverEvent) => void;
    onDispatchComplete?: (response: DispatchResponse) => void;
}

// ─── Defaults ───

const DEFAULT_DISTRIBUTED_CONFIG: DistributedConfig = {
    heartbeatIntervalMs: 5000,
    missedHeartbeatsThreshold: 3,
    defaultDispatchTimeoutMs: 30000,
    maxFailoverAttempts: 2,
    strategy: 'LEAST_LOADED',
};

// ─── WorkerRegistry ───

export class WorkerRegistry {
    private workers: Map<string, WorkerNode> = new Map();
    private config: DistributedConfig;
    private callbacks: DistributedCallbacks;

    constructor(config?: Partial<DistributedConfig>, callbacks?: DistributedCallbacks) {
        this.config = { ...DEFAULT_DISTRIBUTED_CONFIG, ...config };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Register a new worker node.
     */
    public register(
        id: string,
        capabilities: TaskType[],
        maxConcurrency: number = 3,
        metadata: Record<string, unknown> = {},
    ): WorkerNode {
        const worker: WorkerNode = {
            id,
            capabilities: [...capabilities],
            maxConcurrency,
            activeTasks: 0,
            status: 'IDLE',
            lastHeartbeat: Date.now(),
            registeredAt: Date.now(),
            metadata,
        };

        this.workers.set(id, worker);
        this.callbacks.onWorkerRegistered?.(worker);
        return worker;
    }

    /**
     * Deregister a worker (graceful shutdown).
     */
    public deregister(workerId: string): boolean {
        return this.workers.delete(workerId);
    }

    /**
     * Record a heartbeat from a worker.
     */
    public heartbeat(workerId: string): boolean {
        const worker = this.workers.get(workerId);
        if (!worker) return false;

        worker.lastHeartbeat = Date.now();

        // Revive dead workers on heartbeat
        if (worker.status === 'DEAD') {
            worker.status = worker.activeTasks > 0 ? 'BUSY' : 'IDLE';
        }

        return true;
    }

    /**
     * Check all workers for missed heartbeats. Mark DEAD if threshold exceeded.
     * Returns list of newly dead workers.
     */
    public checkHeartbeats(): WorkerNode[] {
        const now = Date.now();
        const timeout = this.config.heartbeatIntervalMs * this.config.missedHeartbeatsThreshold;
        const newlyDead: WorkerNode[] = [];

        for (const worker of this.workers.values()) {
            if (worker.status === 'DEAD') continue;

            if (now - worker.lastHeartbeat > timeout) {
                worker.status = 'DEAD';
                newlyDead.push(worker);
                this.callbacks.onWorkerDead?.(worker);
            }
        }

        return newlyDead;
    }

    /**
     * Set a worker to DRAINING mode (finishes current tasks, accepts no new ones).
     */
    public drain(workerId: string): boolean {
        const worker = this.workers.get(workerId);
        if (!worker || worker.status === 'DEAD') return false;

        worker.status = 'DRAINING';
        this.callbacks.onWorkerDraining?.(worker);
        return true;
    }

    /**
     * Increment active task count for a worker.
     */
    public taskStarted(workerId: string): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;
        worker.activeTasks++;
        if (worker.status === 'IDLE') worker.status = 'BUSY';
    }

    /**
     * Decrement active task count for a worker.
     */
    public taskCompleted(workerId: string): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;
        worker.activeTasks = Math.max(0, worker.activeTasks - 1);
        if (worker.activeTasks === 0 && worker.status === 'BUSY') {
            worker.status = 'IDLE';
        }
        if (worker.activeTasks === 0 && worker.status === 'DRAINING') {
            worker.status = 'IDLE';
        }
    }

    /**
     * Get a worker by ID.
     */
    public getWorker(workerId: string): WorkerNode | undefined {
        return this.workers.get(workerId);
    }

    /**
     * Get all workers with a specific status.
     */
    public getWorkersByStatus(status: WorkerStatus): WorkerNode[] {
        return Array.from(this.workers.values()).filter(w => w.status === status);
    }

    /**
     * Get all available workers (IDLE or BUSY with capacity).
     */
    public getAvailableWorkers(): WorkerNode[] {
        return Array.from(this.workers.values()).filter(w =>
            (w.status === 'IDLE' || w.status === 'BUSY') && w.activeTasks < w.maxConcurrency,
        );
    }

    /**
     * Get workers capable of handling a specific task type.
     */
    public getCapableWorkers(taskType: TaskType): WorkerNode[] {
        return this.getAvailableWorkers().filter(w => w.capabilities.includes(taskType));
    }

    /**
     * Get total worker count.
     */
    public getWorkerCount(): number {
        return this.workers.size;
    }

    /**
     * Get all workers.
     */
    public getAllWorkers(): WorkerNode[] {
        return Array.from(this.workers.values());
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.workers.clear();
    }
}

// ─── LoadBalancer ───

export class LoadBalancer {
    private strategy: LoadBalancingStrategy;
    private roundRobinIndex: number = 0;

    constructor(strategy: LoadBalancingStrategy = 'LEAST_LOADED') {
        this.strategy = strategy;
    }

    /**
     * Select the best worker for a task from the candidate list.
     * Returns undefined if no suitable worker found.
     */
    public select(candidates: WorkerNode[], taskType?: TaskType): WorkerNode | undefined {
        if (candidates.length === 0) return undefined;

        switch (this.strategy) {
            case 'ROUND_ROBIN':
                return this.roundRobin(candidates);
            case 'LEAST_LOADED':
                return this.leastLoaded(candidates);
            case 'CAPABILITY_MATCH':
                return this.capabilityMatch(candidates, taskType);
            default:
                return this.leastLoaded(candidates);
        }
    }

    /**
     * Get the current strategy.
     */
    public getStrategy(): LoadBalancingStrategy {
        return this.strategy;
    }

    /**
     * Change the strategy at runtime.
     */
    public setStrategy(strategy: LoadBalancingStrategy): void {
        this.strategy = strategy;
        this.roundRobinIndex = 0;
    }

    // ─── Strategies ───

    private roundRobin(candidates: WorkerNode[]): WorkerNode {
        const worker = candidates[this.roundRobinIndex % candidates.length];
        this.roundRobinIndex++;
        return worker;
    }

    private leastLoaded(candidates: WorkerNode[]): WorkerNode {
        return candidates.reduce((best, w) => {
            const bestLoad = best.activeTasks / best.maxConcurrency;
            const wLoad = w.activeTasks / w.maxConcurrency;
            return wLoad < bestLoad ? w : best;
        });
    }

    private capabilityMatch(candidates: WorkerNode[], taskType?: TaskType): WorkerNode | undefined {
        // Filter to capable workers first
        let capable = candidates;
        if (taskType) {
            capable = candidates.filter(w => w.capabilities.includes(taskType));
        }
        if (capable.length === 0) return undefined;

        // Among capable, pick least loaded
        return this.leastLoaded(capable);
    }
}

// ─── DistributedDispatcher ───

/** Function that executes a task on a specific worker (pluggable transport) */
export type WorkerExecutor = (workerId: string, task: DAGTask) => Promise<DAGTaskResult>;

export class DistributedDispatcher {
    private registry: WorkerRegistry;
    private balancer: LoadBalancer;
    private config: DistributedConfig;
    private callbacks: DistributedCallbacks;
    private executor: WorkerExecutor;
    private failoverLog: FailoverEvent[] = [];

    constructor(
        registry: WorkerRegistry,
        executor: WorkerExecutor,
        config?: Partial<DistributedConfig>,
        callbacks?: DistributedCallbacks,
    ) {
        this.registry = registry;
        this.executor = executor;
        this.config = { ...DEFAULT_DISTRIBUTED_CONFIG, ...config };
        this.balancer = new LoadBalancer(this.config.strategy);
        this.callbacks = callbacks ?? {};
    }

    /**
     * Dispatch a task to the best available worker.
     * Handles failover on timeout or worker failure.
     */
    public async dispatch(task: DAGTask): Promise<DispatchResponse | null> {
        const candidates = this.registry.getCapableWorkers(task.type);
        const excludeWorkers = new Set<string>();
        let failoverAttempts = 0;

        while (failoverAttempts <= this.config.maxFailoverAttempts) {
            const available = candidates.filter(w => !excludeWorkers.has(w.id));
            const worker = this.balancer.select(available, task.type);

            if (!worker) {
                return null; // No workers available
            }

            this.registry.taskStarted(worker.id);
            this.callbacks.onDispatch?.(task.id, worker.id);

            try {
                const result = await this.executeWithTimeout(worker.id, task, this.config.defaultDispatchTimeoutMs);

                this.registry.taskCompleted(worker.id);

                const response: DispatchResponse = {
                    taskId: task.id,
                    workerId: worker.id,
                    result,
                    failover: failoverAttempts > 0,
                    failoverAttempts,
                };

                this.callbacks.onDispatchComplete?.(response);
                return response;

            } catch (error) {
                this.registry.taskCompleted(worker.id);
                excludeWorkers.add(worker.id);

                const reason = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

                if (failoverAttempts < this.config.maxFailoverAttempts) {
                    // Find the next candidate for failover event logging
                    const nextAvailable = candidates.filter(w => !excludeWorkers.has(w.id));
                    const nextWorker = this.balancer.select(nextAvailable, task.type);

                    const failoverEvent: FailoverEvent = {
                        taskId: task.id,
                        fromWorkerId: worker.id,
                        toWorkerId: nextWorker?.id ?? 'NONE',
                        reason,
                        attempt: failoverAttempts + 1,
                        timestamp: Date.now(),
                    };

                    this.failoverLog.push(failoverEvent);
                    this.callbacks.onFailover?.(failoverEvent);
                }

                failoverAttempts++;
            }
        }

        return null; // All failover attempts exhausted
    }

    /**
     * Get the failover event log.
     */
    public getFailoverLog(): ReadonlyArray<FailoverEvent> {
        return this.failoverLog;
    }

    /**
     * Get the load balancer (for strategy changes).
     */
    public getBalancer(): LoadBalancer {
        return this.balancer;
    }

    /**
     * Reset failover log (for testing).
     */
    public resetLog(): void {
        this.failoverLog = [];
    }

    // ─── Private ───

    private async executeWithTimeout(workerId: string, task: DAGTask, timeoutMs: number): Promise<DAGTaskResult> {
        return new Promise<DAGTaskResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`DISPATCH_TIMEOUT: worker [${workerId}] exceeded ${timeoutMs}ms`));
            }, timeoutMs);

            this.executor(workerId, task)
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}
