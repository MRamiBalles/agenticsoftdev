/**
 * DAG Engine: Directed Acyclic Graph Task Executor
 * 
 * Core execution engine with:
 *   - Topological sort for execution order
 *   - Cycle detection (constitutional violation: Art. III.1)
 *   - Parallel dispatch of independent tasks
 *   - Concurrency limit (configurable)
 *   - Self-healing retry with feedback injection
 *   - Event callbacks for observability
 * 
 * Phase 4.0: DAG Orchestration
 * Compliance: constitution.md Art. III.1 (Zero-Tolerance for Cycles),
 *             Art. V (Structural Integrity)
 */

import { RetryPolicy, TaskType } from './retry-policy';

// ─── Types ───

export type DAGTaskStatus = 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'SKIPPED';

export interface DAGTask {
    id: string;
    type: TaskType;
    agent: string;
    dependencies: string[];
    payload: Record<string, unknown>;
    status: DAGTaskStatus;
    result?: DAGTaskResult;
    retryCount: number;
}

export interface DAGTaskResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
}

export interface DAGGraph {
    tasks: Map<string, DAGTask>;
}

export interface DAGEngineConfig {
    /** Maximum concurrent tasks */
    maxConcurrency: number;
    /** Tick interval for the scheduler loop (ms) */
    tickIntervalMs: number;
    /** Maximum total execution time before forced shutdown (ms) */
    maxExecutionTimeMs: number;
}

export interface DAGExecutionResult {
    totalTasks: number;
    completed: number;
    failed: number;
    skipped: number;
    retries: number;
    durationMs: number;
    circuitBroken: boolean;
    executionOrder: string[];
}

/** Callback invoked by the engine for each task lifecycle event */
export type TaskDispatcher = (task: DAGTask) => Promise<DAGTaskResult>;

export interface DAGEngineCallbacks {
    /** Called when a task is about to be dispatched */
    onDispatch?: (task: DAGTask) => void;
    /** Called when a task completes successfully */
    onComplete?: (task: DAGTask, result: DAGTaskResult) => void;
    /** Called when a task fails */
    onFail?: (task: DAGTask, result: DAGTaskResult) => void;
    /** Called when a task is being retried */
    onRetry?: (task: DAGTask, attempt: number, delayMs: number) => void;
    /** Called when the circuit breaker opens */
    onCircuitBreak?: (consecutiveFailures: number) => void;
}

// ─── Default Config ───

const DEFAULT_CONFIG: DAGEngineConfig = {
    maxConcurrency: 3,
    tickIntervalMs: 50,
    maxExecutionTimeMs: 300_000, // 5 minutes
};

// ─── DAG Engine ───

export class DAGEngine {
    private config: DAGEngineConfig;
    private retryPolicy: RetryPolicy;
    private callbacks: DAGEngineCallbacks;

    constructor(
        config?: Partial<DAGEngineConfig>,
        retryPolicy?: RetryPolicy,
        callbacks?: DAGEngineCallbacks,
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.retryPolicy = retryPolicy ?? new RetryPolicy();
        this.callbacks = callbacks ?? {};

        console.log('🕸️ DAG Engine initialized.');
        console.log(`   Concurrency: ${this.config.maxConcurrency} | Tick: ${this.config.tickIntervalMs}ms | Timeout: ${this.config.maxExecutionTimeMs}ms`);
    }

    /**
     * Validates a DAG graph for structural integrity.
     * Detects cycles (constitutional violation) and missing dependencies.
     */
    public validate(graph: DAGGraph): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check for missing dependencies
        for (const [id, task] of graph.tasks) {
            for (const depId of task.dependencies) {
                if (!graph.tasks.has(depId)) {
                    errors.push(`Task [${id}] depends on non-existent task [${depId}]`);
                }
            }
        }

        // Cycle detection via topological sort
        const cycleResult = this.detectCycles(graph);
        if (cycleResult.hasCycle) {
            errors.push(`CONSTITUTIONAL VIOLATION (Art. III.1): Cyclic dependency detected: ${cycleResult.cycle.join(' → ')}`);
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Executes the DAG graph with parallel dispatch and self-healing.
     * 
     * @param graph - The task graph to execute
     * @param dispatcher - Callback to execute individual tasks
     */
    public async execute(graph: DAGGraph, dispatcher: TaskDispatcher): Promise<DAGExecutionResult> {
        const startTime = Date.now();
        const executionOrder: string[] = [];
        let totalRetries = 0;

        // Validate first
        const validation = this.validate(graph);
        if (!validation.valid) {
            console.error('❌ DAG validation failed:');
            validation.errors.forEach(e => console.error(`   ${e}`));
            return {
                totalTasks: graph.tasks.size,
                completed: 0,
                failed: graph.tasks.size,
                skipped: 0,
                retries: 0,
                durationMs: Date.now() - startTime,
                circuitBroken: false,
                executionOrder: [],
            };
        }

        console.log(`\n🕸️ Executing DAG: ${graph.tasks.size} tasks, max concurrency: ${this.config.maxConcurrency}\n`);

        // Mark all root tasks as READY
        this.updateReadyTasks(graph);

        // Main scheduler loop
        const runningTasks: Map<string, Promise<void>> = new Map();

        while (!this.isComplete(graph)) {
            // Timeout check
            if (Date.now() - startTime > this.config.maxExecutionTimeMs) {
                console.error('⏰ DAG execution timeout. Marking remaining tasks as FAILED.');
                this.timeoutRemainingTasks(graph);
                break;
            }

            // Circuit breaker check
            if (this.retryPolicy.isCircuitOpen()) {
                console.error('🔴 Circuit breaker OPEN. Halting execution.');
                this.callbacks.onCircuitBreak?.(0);
                this.skipRemainingTasks(graph);
                break;
            }

            // Update ready tasks based on completed dependencies
            this.updateReadyTasks(graph);

            // Dispatch ready tasks up to concurrency limit
            const readyTasks = this.getReadyTasks(graph);
            const availableSlots = this.config.maxConcurrency - runningTasks.size;

            for (const task of readyTasks.slice(0, availableSlots)) {
                task.status = 'RUNNING';
                this.callbacks.onDispatch?.(task);

                const taskPromise = this.executeTask(task, graph, dispatcher, executionOrder)
                    .then(retried => { totalRetries += retried; })
                    .finally(() => { runningTasks.delete(task.id); });

                runningTasks.set(task.id, taskPromise);
            }

            // Wait for at least one task to finish or tick
            if (runningTasks.size > 0) {
                await Promise.race([
                    ...runningTasks.values(),
                    new Promise(resolve => setTimeout(resolve, this.config.tickIntervalMs)),
                ]);
            } else {
                await new Promise(resolve => setTimeout(resolve, this.config.tickIntervalMs));
            }
        }

        // Wait for any still-running tasks to finish
        if (runningTasks.size > 0) {
            await Promise.all(runningTasks.values());
        }

        const result = this.buildResult(graph, startTime, totalRetries, executionOrder);

        console.log(`\n🕸️ DAG Execution Complete:`);
        console.log(`   Tasks: ${result.completed}/${result.totalTasks} completed | ${result.failed} failed | ${result.skipped} skipped`);
        console.log(`   Retries: ${result.retries} | Duration: ${result.durationMs}ms`);
        if (result.circuitBroken) console.log('   ⚠️ Circuit breaker was triggered.');

        return result;
    }

    /**
     * Creates a DAGGraph from a simple task definition array.
     */
    public static buildGraph(tasks: {
        id: string;
        type: TaskType;
        agent: string;
        dependencies?: string[];
        payload?: Record<string, unknown>;
    }[]): DAGGraph {
        const graph: DAGGraph = { tasks: new Map() };
        for (const t of tasks) {
            graph.tasks.set(t.id, {
                id: t.id,
                type: t.type,
                agent: t.agent,
                dependencies: t.dependencies ?? [],
                payload: t.payload ?? {},
                status: 'PENDING',
                retryCount: 0,
            });
        }
        return graph;
    }

    // ─── Private: Task Execution ───

    private async executeTask(
        task: DAGTask,
        graph: DAGGraph,
        dispatcher: TaskDispatcher,
        executionOrder: string[],
    ): Promise<number> {
        let retries = 0;

        const runOnce = async (): Promise<void> => {
            try {
                const result = await dispatcher(task);
                task.result = result;

                if (result.exitCode === 0) {
                    task.status = 'COMPLETED';
                    executionOrder.push(task.id);
                    this.retryPolicy.recordSuccess(task.id);
                    this.callbacks.onComplete?.(task, result);
                } else {
                    // Task failed — evaluate retry
                    this.callbacks.onFail?.(task, result);

                    const decision = this.retryPolicy.evaluate({
                        taskId: task.id,
                        taskType: task.type,
                        errorMessage: result.stderr || `Exit code: ${result.exitCode}`,
                        errorOutput: result.stdout + '\n' + result.stderr,
                        originalPayload: task.payload,
                    });

                    if (decision.shouldRetry && decision.feedbackPayload) {
                        retries++;
                        task.retryCount++;
                        task.status = 'RETRYING';
                        task.payload = decision.feedbackPayload;

                        this.callbacks.onRetry?.(task, decision.attempt, decision.delayMs);
                        console.log(`🔄 Retrying [${task.id}] (attempt ${decision.attempt}): ${decision.reason}`);

                        // Wait for backoff delay
                        await new Promise(resolve => setTimeout(resolve, decision.delayMs));

                        task.status = 'RUNNING';
                        await runOnce(); // Recursive retry
                    } else {
                        task.status = 'FAILED';
                        console.error(`❌ Task [${task.id}] FAILED permanently: ${decision.reason}`);

                        // Skip dependent tasks
                        this.skipDependents(task.id, graph);
                    }
                }
            } catch (error) {
                task.status = 'FAILED';
                task.result = {
                    exitCode: 1,
                    stdout: '',
                    stderr: (error as Error).message,
                    durationMs: 0,
                };
                console.error(`❌ Task [${task.id}] threw exception: ${(error as Error).message}`);
                this.skipDependents(task.id, graph);
            }
        };

        await runOnce();
        return retries;
    }

    // ─── Private: Graph Operations ───

    private updateReadyTasks(graph: DAGGraph): void {
        for (const task of graph.tasks.values()) {
            if (task.status !== 'PENDING') continue;

            const depsResolved = task.dependencies.every(depId => {
                const dep = graph.tasks.get(depId);
                return dep?.status === 'COMPLETED';
            });

            const depsFailed = task.dependencies.some(depId => {
                const dep = graph.tasks.get(depId);
                return dep?.status === 'FAILED' || dep?.status === 'SKIPPED';
            });

            if (depsFailed) {
                task.status = 'SKIPPED';
                console.log(`⏭️ Skipping [${task.id}]: dependency failed`);
            } else if (depsResolved) {
                task.status = 'READY';
            }
        }
    }

    private getReadyTasks(graph: DAGGraph): DAGTask[] {
        return Array.from(graph.tasks.values()).filter(t => t.status === 'READY');
    }

    private isComplete(graph: DAGGraph): boolean {
        return Array.from(graph.tasks.values()).every(t =>
            t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'SKIPPED'
        );
    }

    private skipDependents(failedTaskId: string, graph: DAGGraph): void {
        for (const task of graph.tasks.values()) {
            if (task.dependencies.includes(failedTaskId) && task.status === 'PENDING') {
                task.status = 'SKIPPED';
                console.log(`⏭️ Skipping [${task.id}]: depends on failed [${failedTaskId}]`);
                this.skipDependents(task.id, graph); // Cascade skip
            }
        }
    }

    private skipRemainingTasks(graph: DAGGraph): void {
        for (const task of graph.tasks.values()) {
            if (task.status === 'PENDING' || task.status === 'READY') {
                task.status = 'SKIPPED';
            }
        }
    }

    private timeoutRemainingTasks(graph: DAGGraph): void {
        for (const task of graph.tasks.values()) {
            if (task.status === 'PENDING' || task.status === 'READY' || task.status === 'RUNNING') {
                task.status = 'FAILED';
                task.result = { exitCode: 124, stdout: '', stderr: 'DAG execution timeout', durationMs: 0 };
            }
        }
    }

    // ─── Private: Cycle Detection (Kahn's Algorithm) ───

    private detectCycles(graph: DAGGraph): { hasCycle: boolean; cycle: string[] } {
        const inDegree: Map<string, number> = new Map();
        const adjacency: Map<string, string[]> = new Map();

        // Initialize
        for (const [id] of graph.tasks) {
            inDegree.set(id, 0);
            adjacency.set(id, []);
        }

        // Build adjacency and in-degree
        for (const [id, task] of graph.tasks) {
            for (const depId of task.dependencies) {
                if (adjacency.has(depId)) {
                    adjacency.get(depId)!.push(id);
                    inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
                }
            }
        }

        // Kahn's algorithm
        const queue: string[] = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0) queue.push(id);
        }

        const sorted: string[] = [];
        while (queue.length > 0) {
            const node = queue.shift()!;
            sorted.push(node);

            for (const neighbor of adjacency.get(node) ?? []) {
                const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) queue.push(neighbor);
            }
        }

        if (sorted.length !== graph.tasks.size) {
            // Cycle exists — find the nodes involved
            const cycleNodes = Array.from(graph.tasks.keys()).filter(id => !sorted.includes(id));
            return { hasCycle: true, cycle: cycleNodes };
        }

        return { hasCycle: false, cycle: [] };
    }

    // ─── Private: Result Builder ───

    private buildResult(
        graph: DAGGraph,
        startTime: number,
        totalRetries: number,
        executionOrder: string[],
    ): DAGExecutionResult {
        let completed = 0;
        let failed = 0;
        let skipped = 0;

        for (const task of graph.tasks.values()) {
            if (task.status === 'COMPLETED') completed++;
            else if (task.status === 'FAILED') failed++;
            else if (task.status === 'SKIPPED') skipped++;
        }

        return {
            totalTasks: graph.tasks.size,
            completed,
            failed,
            skipped,
            retries: totalRetries,
            durationMs: Date.now() - startTime,
            circuitBroken: this.retryPolicy.isCircuitOpen(),
            executionOrder,
        };
    }
}
