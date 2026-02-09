/**
 * Execution Persistence: Checkpoint, Restore & Replay
 * 
 * Enables crash recovery and forensic replay:
 *   - Serialize DAG state, execution metadata, agent profiles, bus messages
 *   - SHA-256 integrity verification on checkpoints
 *   - Partial restore: completed tasks preserved, pending re-queued
 *   - Event replay: re-emit all recorded events without re-execution
 *   - Auto-pruning of old checkpoints
 * 
 * Phase 4.5: Persistent Execution State
 * Compliance: constitution.md Art. II (No Opaque Blobs — checkpoints are inspectable),
 *             Art. V (Structural Integrity — tamper detection via SHA-256)
 */

import * as crypto from 'crypto';
import { DAGTask, DAGTaskResult, DAGGraph, DAGExecutionResult, DAGTaskStatus } from './dag-engine';
import { AgentMessage } from './agent-bus';
import { TaskOutcome } from './agent-learning';
import { TaskType } from './retry-policy';

// ─── Types ───

/** Serializable representation of a DAGTask */
export interface SerializedTask {
    id: string;
    type: TaskType;
    agent: string;
    dependencies: string[];
    payload: Record<string, unknown>;
    status: DAGTaskStatus;
    result?: DAGTaskResult;
    retryCount: number;
    depth: number;
    parentId?: string;
}

/** Serializable representation of the DAG graph */
export interface SerializedGraph {
    tasks: SerializedTask[];
}

/** Full execution snapshot for persistence */
export interface ExecutionSnapshot {
    /** Unique checkpoint ID */
    id: string;
    /** Snapshot version for forward compatibility */
    version: number;
    /** DAG graph state */
    graph: SerializedGraph;
    /** Execution metadata */
    executionOrder: string[];
    totalRetries: number;
    totalSpawned: number;
    /** Agent learning outcomes */
    outcomes: TaskOutcome[];
    /** Bus message log */
    messages: AgentMessage[];
    /** Timestamp of checkpoint creation */
    createdAt: number;
    /** Duration of execution at checkpoint time (ms) */
    elapsedMs: number;
    /** Human-readable label */
    label?: string;
}

/** A checkpoint wraps a snapshot with integrity metadata */
export interface Checkpoint {
    snapshot: ExecutionSnapshot;
    /** SHA-256 hash of the serialized snapshot */
    hash: string;
    /** Size in bytes of the serialized snapshot */
    sizeBytes: number;
}

/** Policy for checkpoint behavior */
export interface CheckpointPolicy {
    /** Auto-checkpoint every N completed tasks (0 = disabled) */
    autoCheckpointInterval: number;
    /** Maximum checkpoints to retain (oldest pruned) */
    maxCheckpoints: number;
    /** Whether to verify integrity on load */
    verifyOnLoad: boolean;
}

/** Result of a restore operation */
export interface RestoreResult {
    success: boolean;
    snapshot?: ExecutionSnapshot;
    graph?: DAGGraph;
    /** Tasks that will be re-queued (PENDING/READY/RUNNING → PENDING) */
    requeued: string[];
    /** Tasks already completed */
    preserved: string[];
    /** Error details if restore failed */
    error?: string;
}

/** Replay event for forensic analysis */
export interface ReplayEvent {
    type: 'DISPATCH' | 'COMPLETE' | 'FAIL' | 'SPAWN' | 'MESSAGE' | 'OUTCOME';
    taskId?: string;
    data: Record<string, unknown>;
    timestamp: number;
    index: number;
}

/** Callbacks for persistence observability */
export interface PersistenceCallbacks {
    onCheckpointSaved?: (checkpoint: Checkpoint) => void;
    onCheckpointLoaded?: (snapshot: ExecutionSnapshot) => void;
    onIntegrityViolation?: (checkpointId: string, expected: string, actual: string) => void;
    onReplayEvent?: (event: ReplayEvent) => void;
    onPruned?: (prunedIds: string[]) => void;
}

// ─── Defaults ───

const DEFAULT_CHECKPOINT_POLICY: CheckpointPolicy = {
    autoCheckpointInterval: 5,
    maxCheckpoints: 10,
    verifyOnLoad: true,
};

const SNAPSHOT_VERSION = 1;

// ─── Utility ───

let checkpointCounter = 0;

function generateCheckpointId(): string {
    checkpointCounter++;
    return `ckpt_${Date.now()}_${checkpointCounter}`;
}

function computeHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// ─── Serialization ───

/**
 * Serialize a DAGGraph (Map-based) to a plain object.
 */
export function serializeGraph(graph: DAGGraph): SerializedGraph {
    const tasks: SerializedTask[] = [];
    for (const [, task] of graph.tasks) {
        tasks.push({
            id: task.id,
            type: task.type,
            agent: task.agent,
            dependencies: [...task.dependencies],
            payload: { ...task.payload },
            status: task.status,
            result: task.result ? { ...task.result } : undefined,
            retryCount: task.retryCount,
            depth: task.depth,
            parentId: task.parentId,
        });
    }
    return { tasks };
}

/**
 * Deserialize a SerializedGraph back to a DAGGraph (Map-based).
 */
export function deserializeGraph(serialized: SerializedGraph): DAGGraph {
    const tasks = new Map<string, DAGTask>();
    for (const st of serialized.tasks) {
        tasks.set(st.id, {
            id: st.id,
            type: st.type,
            agent: st.agent,
            dependencies: [...st.dependencies],
            payload: { ...st.payload },
            status: st.status,
            result: st.result ? { ...st.result } : undefined,
            retryCount: st.retryCount,
            depth: st.depth,
            parentId: st.parentId,
        });
    }
    return { tasks };
}

// ─── CheckpointManager ───

export class CheckpointManager {
    private checkpoints: Map<string, Checkpoint> = new Map();
    private checkpointOrder: string[] = [];
    private policy: CheckpointPolicy;
    private callbacks: PersistenceCallbacks;
    private completedSinceLastCheckpoint: number = 0;

    constructor(policy?: Partial<CheckpointPolicy>, callbacks?: PersistenceCallbacks) {
        this.policy = { ...DEFAULT_CHECKPOINT_POLICY, ...policy };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Save a checkpoint from current execution state.
     */
    public save(
        graph: DAGGraph,
        executionOrder: string[],
        totalRetries: number,
        totalSpawned: number,
        outcomes: TaskOutcome[],
        messages: AgentMessage[],
        elapsedMs: number,
        label?: string,
    ): Checkpoint {
        const snapshot: ExecutionSnapshot = {
            id: generateCheckpointId(),
            version: SNAPSHOT_VERSION,
            graph: serializeGraph(graph),
            executionOrder: [...executionOrder],
            totalRetries,
            totalSpawned,
            outcomes: outcomes.map(o => ({ ...o })),
            messages: messages.map(m => ({ ...m })),
            createdAt: Date.now(),
            elapsedMs,
            label,
        };

        const serialized = JSON.stringify(snapshot);
        const hash = computeHash(serialized);

        const checkpoint: Checkpoint = {
            snapshot,
            hash,
            sizeBytes: serialized.length,
        };

        this.checkpoints.set(snapshot.id, checkpoint);
        this.checkpointOrder.push(snapshot.id);
        this.completedSinceLastCheckpoint = 0;

        // Prune old checkpoints
        this.prune();

        this.callbacks.onCheckpointSaved?.(checkpoint);

        return checkpoint;
    }

    /**
     * Load a checkpoint by ID. Verifies integrity if policy requires it.
     */
    public load(checkpointId: string): RestoreResult {
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) {
            return { success: false, error: `CHECKPOINT_NOT_FOUND: ${checkpointId}`, requeued: [], preserved: [] };
        }

        // Integrity verification
        if (this.policy.verifyOnLoad) {
            const serialized = JSON.stringify(checkpoint.snapshot);
            const actualHash = computeHash(serialized);

            if (actualHash !== checkpoint.hash) {
                this.callbacks.onIntegrityViolation?.(checkpointId, checkpoint.hash, actualHash);
                return {
                    success: false,
                    error: `INTEGRITY_VIOLATION: expected ${checkpoint.hash}, got ${actualHash}`,
                    requeued: [],
                    preserved: [],
                };
            }
        }

        // Deserialize graph
        const graph = deserializeGraph(checkpoint.snapshot.graph);
        const requeued: string[] = [];
        const preserved: string[] = [];

        // Re-queue incomplete tasks
        for (const [, task] of graph.tasks) {
            if (task.status === 'COMPLETED') {
                preserved.push(task.id);
            } else if (task.status === 'FAILED' || task.status === 'SKIPPED') {
                preserved.push(task.id);
            } else {
                // PENDING, READY, RUNNING, RETRYING → re-queue as PENDING
                task.status = 'PENDING';
                task.result = undefined;
                requeued.push(task.id);
            }
        }

        this.callbacks.onCheckpointLoaded?.(checkpoint.snapshot);

        return {
            success: true,
            snapshot: checkpoint.snapshot,
            graph,
            requeued,
            preserved,
        };
    }

    /**
     * Load the most recent checkpoint.
     */
    public loadLatest(): RestoreResult {
        if (this.checkpointOrder.length === 0) {
            return { success: false, error: 'NO_CHECKPOINTS', requeued: [], preserved: [] };
        }
        const latestId = this.checkpointOrder[this.checkpointOrder.length - 1];
        return this.load(latestId);
    }

    /**
     * Notify the manager that a task completed (for auto-checkpoint logic).
     * Returns true if an auto-checkpoint should be triggered.
     */
    public notifyTaskCompleted(): boolean {
        if (this.policy.autoCheckpointInterval <= 0) return false;
        this.completedSinceLastCheckpoint++;
        return this.completedSinceLastCheckpoint >= this.policy.autoCheckpointInterval;
    }

    /**
     * Get a checkpoint by ID.
     */
    public getCheckpoint(checkpointId: string): Checkpoint | undefined {
        return this.checkpoints.get(checkpointId);
    }

    /**
     * List all checkpoint IDs (oldest first).
     */
    public listCheckpoints(): string[] {
        return [...this.checkpointOrder];
    }

    /**
     * Get the number of stored checkpoints.
     */
    public getCheckpointCount(): number {
        return this.checkpoints.size;
    }

    /**
     * Get the policy.
     */
    public getPolicy(): CheckpointPolicy {
        return { ...this.policy };
    }

    /**
     * Inject a checkpoint directly (for testing tamper scenarios).
     */
    public inject(checkpoint: Checkpoint): void {
        this.checkpoints.set(checkpoint.snapshot.id, checkpoint);
        this.checkpointOrder.push(checkpoint.snapshot.id);
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.checkpoints.clear();
        this.checkpointOrder = [];
        this.completedSinceLastCheckpoint = 0;
    }

    // ─── Private ───

    private prune(): void {
        if (this.checkpoints.size <= this.policy.maxCheckpoints) return;

        const toPrune: string[] = [];
        while (this.checkpointOrder.length > this.policy.maxCheckpoints) {
            const oldId = this.checkpointOrder.shift()!;
            this.checkpoints.delete(oldId);
            toPrune.push(oldId);
        }

        if (toPrune.length > 0) {
            this.callbacks.onPruned?.(toPrune);
        }
    }
}

// ─── ExecutionReplay ───

export class ExecutionReplay {
    private callbacks: PersistenceCallbacks;

    constructor(callbacks?: PersistenceCallbacks) {
        this.callbacks = callbacks ?? {};
    }

    /**
     * Replay all events from a snapshot in order.
     * Emits ReplayEvents for each recorded action.
     */
    public replay(snapshot: ExecutionSnapshot): ReplayEvent[] {
        const events: ReplayEvent[] = [];
        let index = 0;

        // Replay task lifecycle from execution order + graph state
        for (const taskId of snapshot.executionOrder) {
            const taskData = snapshot.graph.tasks.find(t => t.id === taskId);
            if (!taskData) continue;

            // Dispatch event
            const dispatchEvent: ReplayEvent = {
                type: 'DISPATCH',
                taskId,
                data: { agent: taskData.agent, type: taskData.type, depth: taskData.depth },
                timestamp: snapshot.createdAt,
                index: index++,
            };
            events.push(dispatchEvent);
            this.callbacks.onReplayEvent?.(dispatchEvent);

            // Completion or failure
            if (taskData.status === 'COMPLETED' && taskData.result) {
                const completeEvent: ReplayEvent = {
                    type: 'COMPLETE',
                    taskId,
                    data: {
                        exitCode: taskData.result.exitCode,
                        durationMs: taskData.result.durationMs,
                        stdout: taskData.result.stdout.slice(0, 200),
                    },
                    timestamp: snapshot.createdAt,
                    index: index++,
                };
                events.push(completeEvent);
                this.callbacks.onReplayEvent?.(completeEvent);
            } else if (taskData.status === 'FAILED' && taskData.result) {
                const failEvent: ReplayEvent = {
                    type: 'FAIL',
                    taskId,
                    data: {
                        exitCode: taskData.result.exitCode,
                        stderr: taskData.result.stderr.slice(0, 200),
                    },
                    timestamp: snapshot.createdAt,
                    index: index++,
                };
                events.push(failEvent);
                this.callbacks.onReplayEvent?.(failEvent);
            }

            // Spawn events (tasks with parentId matching this task)
            const spawned = snapshot.graph.tasks.filter(t => t.parentId === taskId);
            for (const child of spawned) {
                const spawnEvent: ReplayEvent = {
                    type: 'SPAWN',
                    taskId,
                    data: { childId: child.id, childType: child.type, childDepth: child.depth },
                    timestamp: snapshot.createdAt,
                    index: index++,
                };
                events.push(spawnEvent);
                this.callbacks.onReplayEvent?.(spawnEvent);
            }
        }

        // Replay messages
        for (const msg of snapshot.messages) {
            const msgEvent: ReplayEvent = {
                type: 'MESSAGE',
                data: { topic: msg.topic, sender: msg.sender, target: msg.target, payloadSize: JSON.stringify(msg.payload).length },
                timestamp: msg.timestamp,
                index: index++,
            };
            events.push(msgEvent);
            this.callbacks.onReplayEvent?.(msgEvent);
        }

        // Replay outcomes
        for (const outcome of snapshot.outcomes) {
            const outcomeEvent: ReplayEvent = {
                type: 'OUTCOME',
                taskId: outcome.taskId,
                data: { agent: outcome.agent, taskType: outcome.taskType, success: outcome.success, durationMs: outcome.durationMs },
                timestamp: outcome.timestamp,
                index: index++,
            };
            events.push(outcomeEvent);
            this.callbacks.onReplayEvent?.(outcomeEvent);
        }

        return events;
    }

    /**
     * Get a summary of what happened in a snapshot.
     */
    public summarize(snapshot: ExecutionSnapshot): {
        totalTasks: number;
        completed: number;
        failed: number;
        skipped: number;
        spawned: number;
        messages: number;
        outcomes: number;
        elapsedMs: number;
    } {
        const tasks = snapshot.graph.tasks;
        return {
            totalTasks: tasks.length,
            completed: tasks.filter(t => t.status === 'COMPLETED').length,
            failed: tasks.filter(t => t.status === 'FAILED').length,
            skipped: tasks.filter(t => t.status === 'SKIPPED').length,
            spawned: snapshot.totalSpawned,
            messages: snapshot.messages.length,
            outcomes: snapshot.outcomes.length,
            elapsedMs: snapshot.elapsedMs,
        };
    }
}
