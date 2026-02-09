/**
 * Agent Self-Healing: Failure Detection, Corrective Actions & Escalation
 * 
 * Enables automatic error recovery:
 *   - Classify failures: OOM, TIMEOUT, DEPENDENCY_FAILURE, CRASH, PERMISSION_DENIED, NETWORK_ERROR
 *   - Apply corrective actions in priority order: restart, reroute, scale-down, backoff, skip
 *   - Escalate to humans when self-repair fails or confidence is too low
 *   - All healing attempts logged for forensic analysis and learning feedback
 * 
 * Phase 4.7: Agent Self-Healing
 * Compliance: constitution.md Art. I (Human Authority — escalation preserves human override),
 *             Art. II (No Opaque Blobs — healing records are inspectable),
 *             Art. V (Structural Integrity — self-repair prevents cascade failures)
 */

import { TaskType } from './retry-policy';
import { DAGTaskResult } from './dag-engine';

// ─── Types ───

export type FailureCategory =
    | 'OOM'
    | 'TIMEOUT'
    | 'DEPENDENCY_FAILURE'
    | 'CRASH'
    | 'PERMISSION_DENIED'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';

export type HealingActionType =
    | 'RESTART'
    | 'REROUTE'
    | 'SCALE_DOWN'
    | 'RETRY_WITH_BACKOFF'
    | 'SKIP_DEPENDENCY'
    | 'ESCALATE';

export type EscalationLevel = 'WARN' | 'ALERT' | 'BLOCK';

/** Result of failure classification */
export interface FailureClassification {
    category: FailureCategory;
    /** Confidence score 0–1 based on signal strength */
    confidence: number;
    /** Evidence that led to this classification */
    signals: string[];
    /** Raw error data */
    stderr?: string;
    exitCode?: number;
    durationMs?: number;
}

/** A healing action to attempt */
export interface HealingAction {
    type: HealingActionType;
    /** Human-readable description */
    description: string;
    /** Max times this action can be attempted for a single task */
    maxAttempts: number;
    /** Cooldown between attempts (ms) */
    cooldownMs: number;
    /** Parameters specific to this action */
    params: Record<string, unknown>;
}

/** Strategy: maps failure categories to ordered healing actions */
export interface HealingStrategy {
    /** Failure category this strategy handles */
    category: FailureCategory;
    /** Ordered list of actions to try (first = highest priority) */
    actions: HealingAction[];
}

/** Policy for when to escalate to humans */
export interface EscalationPolicy {
    /** Escalate if confidence below this threshold */
    minConfidence: number;
    /** Max total healing attempts per task before forced escalation */
    maxHealingAttempts: number;
    /** Task types that always escalate on failure (critical tasks) */
    criticalTaskTypes: TaskType[];
    /** Default escalation level */
    defaultLevel: EscalationLevel;
}

/** Record of a healing attempt */
export interface HealingRecord {
    taskId: string;
    agent: string;
    taskType: TaskType;
    failure: FailureClassification;
    actionTaken: HealingActionType;
    /** Whether the healing action succeeded */
    success: boolean;
    /** Attempt number (1-based) */
    attempt: number;
    /** Duration of healing attempt (ms) */
    durationMs: number;
    timestamp: number;
}

/** Escalation event */
export interface EscalationEvent {
    taskId: string;
    agent: string;
    taskType: TaskType;
    level: EscalationLevel;
    reason: string;
    failure: FailureClassification;
    healingAttempts: number;
    timestamp: number;
}

/** Healing result returned to caller */
export interface HealingResult {
    /** Whether any healing action succeeded */
    healed: boolean;
    /** Action that succeeded (if healed) */
    successfulAction?: HealingActionType;
    /** All actions attempted */
    attempts: HealingRecord[];
    /** Escalation event if escalated */
    escalation?: EscalationEvent;
}

/** Callbacks for self-healing observability */
export interface SelfHealingCallbacks {
    onFailureDetected?: (classification: FailureClassification, taskId: string) => void;
    onHealingAttempt?: (record: HealingRecord) => void;
    onHealingSuccess?: (record: HealingRecord) => void;
    onEscalation?: (event: EscalationEvent) => void;
}

// ─── Defaults ───

const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
    minConfidence: 0.5,
    maxHealingAttempts: 3,
    criticalTaskTypes: ['PLAN', 'DEPLOY'],
    defaultLevel: 'ALERT',
};

// ─── Failure Detection Patterns ───

interface DetectionPattern {
    category: FailureCategory;
    /** Patterns to match in stderr */
    stderrPatterns: RegExp[];
    /** Exit codes that indicate this failure */
    exitCodes: number[];
    /** Base confidence when pattern matches */
    baseConfidence: number;
}

const DETECTION_PATTERNS: DetectionPattern[] = [
    {
        category: 'OOM',
        stderrPatterns: [
            /out of memory/i,
            /OOM/i,
            /memory limit/i,
            /killed.*memory/i,
            /heap.*exceeded/i,
            /ENOMEM/i,
            /allocation failed/i,
        ],
        exitCodes: [137, 9],
        baseConfidence: 0.9,
    },
    {
        category: 'TIMEOUT',
        stderrPatterns: [
            /timeout/i,
            /timed out/i,
            /deadline exceeded/i,
            /ETIMEDOUT/i,
            /execution time/i,
        ],
        exitCodes: [124, 142],
        baseConfidence: 0.85,
    },
    {
        category: 'DEPENDENCY_FAILURE',
        stderrPatterns: [
            /dependency.*fail/i,
            /module not found/i,
            /cannot find module/i,
            /import.*error/i,
            /require.*error/i,
            /ENOENT/i,
            /not installed/i,
        ],
        exitCodes: [],
        baseConfidence: 0.8,
    },
    {
        category: 'PERMISSION_DENIED',
        stderrPatterns: [
            /permission denied/i,
            /EACCES/i,
            /EPERM/i,
            /access denied/i,
            /unauthorized/i,
            /forbidden/i,
        ],
        exitCodes: [126],
        baseConfidence: 0.9,
    },
    {
        category: 'NETWORK_ERROR',
        stderrPatterns: [
            /ECONNREFUSED/i,
            /ECONNRESET/i,
            /ENOTFOUND/i,
            /network.*error/i,
            /DNS.*fail/i,
            /socket hang up/i,
            /fetch failed/i,
        ],
        exitCodes: [],
        baseConfidence: 0.85,
    },
    {
        category: 'CRASH',
        stderrPatterns: [
            /segmentation fault/i,
            /SIGSEGV/i,
            /SIGABRT/i,
            /core dumped/i,
            /fatal error/i,
            /unhandled.*exception/i,
            /panic/i,
        ],
        exitCodes: [134, 139, 11],
        baseConfidence: 0.85,
    },
];

// ─── Default Healing Strategies ───

const DEFAULT_HEALING_STRATEGIES: HealingStrategy[] = [
    {
        category: 'OOM',
        actions: [
            { type: 'SCALE_DOWN', description: 'Reduce payload complexity to lower memory usage', maxAttempts: 2, cooldownMs: 1000, params: { reductionFactor: 0.5 } },
            { type: 'REROUTE', description: 'Reroute to a worker with more resources', maxAttempts: 1, cooldownMs: 500, params: {} },
            { type: 'ESCALATE', description: 'Escalate OOM to human review', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
    {
        category: 'TIMEOUT',
        actions: [
            { type: 'RETRY_WITH_BACKOFF', description: 'Retry with exponential backoff', maxAttempts: 2, cooldownMs: 2000, params: { backoffMultiplier: 2 } },
            { type: 'REROUTE', description: 'Reroute to a less loaded worker', maxAttempts: 1, cooldownMs: 500, params: {} },
            { type: 'ESCALATE', description: 'Escalate persistent timeout', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
    {
        category: 'DEPENDENCY_FAILURE',
        actions: [
            { type: 'SKIP_DEPENDENCY', description: 'Skip optional failed dependency', maxAttempts: 1, cooldownMs: 0, params: {} },
            { type: 'RESTART', description: 'Restart after dependency resolution', maxAttempts: 1, cooldownMs: 1000, params: {} },
            { type: 'ESCALATE', description: 'Escalate dependency issue', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
    {
        category: 'CRASH',
        actions: [
            { type: 'RESTART', description: 'Restart crashed task', maxAttempts: 2, cooldownMs: 1000, params: {} },
            { type: 'REROUTE', description: 'Reroute to different worker', maxAttempts: 1, cooldownMs: 500, params: {} },
            { type: 'ESCALATE', description: 'Escalate persistent crash', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
    {
        category: 'PERMISSION_DENIED',
        actions: [
            { type: 'ESCALATE', description: 'Permission issues require human intervention', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
    {
        category: 'NETWORK_ERROR',
        actions: [
            { type: 'RETRY_WITH_BACKOFF', description: 'Retry with backoff for transient network issues', maxAttempts: 3, cooldownMs: 1000, params: { backoffMultiplier: 2 } },
            { type: 'REROUTE', description: 'Reroute to worker in different region', maxAttempts: 1, cooldownMs: 500, params: {} },
            { type: 'ESCALATE', description: 'Escalate persistent network failure', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
    {
        category: 'UNKNOWN',
        actions: [
            { type: 'RESTART', description: 'Restart with fresh state', maxAttempts: 1, cooldownMs: 1000, params: {} },
            { type: 'ESCALATE', description: 'Escalate unknown failure for investigation', maxAttempts: 1, cooldownMs: 0, params: {} },
        ],
    },
];

// ─── FailureDetector ───

export class FailureDetector {
    private patterns: DetectionPattern[];

    constructor(customPatterns?: DetectionPattern[]) {
        this.patterns = customPatterns ?? DETECTION_PATTERNS;
    }

    /**
     * Classify a task failure based on its result.
     */
    public classify(result: DAGTaskResult, durationMs?: number): FailureClassification {
        const signals: string[] = [];
        let bestCategory: FailureCategory = 'UNKNOWN';
        let bestConfidence = 0;

        for (const pattern of this.patterns) {
            let confidence = 0;
            const patternSignals: string[] = [];

            // Check stderr patterns
            for (const regex of pattern.stderrPatterns) {
                if (regex.test(result.stderr)) {
                    confidence = Math.max(confidence, pattern.baseConfidence);
                    patternSignals.push(`stderr matches: ${regex.source}`);
                }
            }

            // Check exit codes
            if (pattern.exitCodes.includes(result.exitCode)) {
                confidence = Math.max(confidence, pattern.baseConfidence * 0.9);
                patternSignals.push(`exit code ${result.exitCode}`);
            }

            // Duration anomaly boosts TIMEOUT confidence
            if (pattern.category === 'TIMEOUT' && durationMs && durationMs > 25000) {
                confidence = Math.max(confidence, 0.7);
                patternSignals.push(`long duration: ${durationMs}ms`);
            }

            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestCategory = pattern.category;
                signals.length = 0;
                signals.push(...patternSignals);
            }
        }

        // Fallback: nonzero exit code with no pattern match
        if (bestCategory === 'UNKNOWN' && result.exitCode !== 0) {
            bestConfidence = 0.3;
            signals.push(`unrecognized exit code: ${result.exitCode}`);
        }

        return {
            category: bestCategory,
            confidence: bestConfidence,
            signals,
            stderr: result.stderr,
            exitCode: result.exitCode,
            durationMs: durationMs ?? result.durationMs,
        };
    }
}

// ─── HealingEngine ───

/** Function that attempts a healing action. Returns true if healed. */
export type HealingExecutor = (taskId: string, action: HealingAction, failure: FailureClassification) => Promise<boolean>;

export class HealingEngine {
    private strategies: Map<FailureCategory, HealingStrategy>;
    private policy: EscalationPolicy;
    private callbacks: SelfHealingCallbacks;
    private records: HealingRecord[] = [];
    private taskAttemptCounts: Map<string, number> = new Map();

    constructor(
        strategies?: HealingStrategy[],
        policy?: Partial<EscalationPolicy>,
        callbacks?: SelfHealingCallbacks,
    ) {
        const strats = strategies ?? DEFAULT_HEALING_STRATEGIES;
        this.strategies = new Map(strats.map(s => [s.category, s]));
        this.policy = { ...DEFAULT_ESCALATION_POLICY, ...policy };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Attempt to heal a failed task.
     * Tries actions in priority order for the detected failure category.
     */
    public async heal(
        taskId: string,
        agent: string,
        taskType: TaskType,
        failure: FailureClassification,
        executor: HealingExecutor,
    ): Promise<HealingResult> {
        const attempts: HealingRecord[] = [];
        const totalAttempts = this.taskAttemptCounts.get(taskId) ?? 0;

        this.callbacks.onFailureDetected?.(failure, taskId);

        // Immediate escalation conditions
        if (this.shouldEscalateImmediately(taskType, failure, totalAttempts)) {
            const escalation = this.createEscalation(
                taskId, agent, taskType, failure, totalAttempts,
                this.getEscalationReason(taskType, failure, totalAttempts),
            );
            this.callbacks.onEscalation?.(escalation);
            return { healed: false, attempts, escalation };
        }

        // Get strategy for this failure category
        const strategy = this.strategies.get(failure.category);
        if (!strategy) {
            const escalation = this.createEscalation(
                taskId, agent, taskType, failure, totalAttempts,
                `No healing strategy for category: ${failure.category}`,
            );
            this.callbacks.onEscalation?.(escalation);
            return { healed: false, attempts, escalation };
        }

        // Try actions in priority order
        for (const action of strategy.actions) {
            if (action.type === 'ESCALATE') {
                const escalation = this.createEscalation(
                    taskId, agent, taskType, failure, attempts.length,
                    `All healing actions exhausted for ${failure.category}`,
                );
                this.callbacks.onEscalation?.(escalation);
                return { healed: false, attempts, escalation };
            }

            const startTime = Date.now();
            let success = false;

            try {
                success = await executor(taskId, action, failure);
            } catch {
                success = false;
            }

            const record: HealingRecord = {
                taskId,
                agent,
                taskType,
                failure,
                actionTaken: action.type,
                success,
                attempt: attempts.length + 1,
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
            };

            attempts.push(record);
            this.records.push(record);
            this.callbacks.onHealingAttempt?.(record);

            // Update attempt count
            this.taskAttemptCounts.set(taskId, totalAttempts + attempts.length);

            if (success) {
                this.callbacks.onHealingSuccess?.(record);
                return { healed: true, successfulAction: action.type, attempts };
            }
        }

        // All non-escalate actions failed — escalate
        const escalation = this.createEscalation(
            taskId, agent, taskType, failure, attempts.length,
            `All ${attempts.length} healing actions failed for ${failure.category}`,
        );
        this.callbacks.onEscalation?.(escalation);
        return { healed: false, attempts, escalation };
    }

    /**
     * Get all healing records.
     */
    public getRecords(): ReadonlyArray<HealingRecord> {
        return this.records;
    }

    /**
     * Get healing records for a specific task.
     */
    public getTaskRecords(taskId: string): HealingRecord[] {
        return this.records.filter(r => r.taskId === taskId);
    }

    /**
     * Get healing success rate across all records.
     */
    public getSuccessRate(): number {
        if (this.records.length === 0) return 0;
        const successes = this.records.filter(r => r.success).length;
        return successes / this.records.length;
    }

    /**
     * Get the escalation policy.
     */
    public getPolicy(): EscalationPolicy {
        return { ...this.policy };
    }

    /**
     * Get available strategies.
     */
    public getStrategies(): Map<FailureCategory, HealingStrategy> {
        return new Map(this.strategies);
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.records = [];
        this.taskAttemptCounts.clear();
    }

    // ─── Private ───

    private shouldEscalateImmediately(
        taskType: TaskType,
        failure: FailureClassification,
        totalAttempts: number,
    ): boolean {
        // Critical task types always escalate
        if (this.policy.criticalTaskTypes.includes(taskType)) {
            return true;
        }

        // Low confidence → escalate
        if (failure.confidence < this.policy.minConfidence) {
            return true;
        }

        // Too many total attempts
        if (totalAttempts >= this.policy.maxHealingAttempts) {
            return true;
        }

        return false;
    }

    private getEscalationReason(
        taskType: TaskType,
        failure: FailureClassification,
        totalAttempts: number,
    ): string {
        if (this.policy.criticalTaskTypes.includes(taskType)) {
            return `Critical task type [${taskType}] requires human review`;
        }
        if (failure.confidence < this.policy.minConfidence) {
            return `Low confidence (${failure.confidence.toFixed(2)}) — uncertain diagnosis`;
        }
        if (totalAttempts >= this.policy.maxHealingAttempts) {
            return `Max healing attempts (${this.policy.maxHealingAttempts}) exhausted`;
        }
        return 'Unknown escalation reason';
    }

    private createEscalation(
        taskId: string,
        agent: string,
        taskType: TaskType,
        failure: FailureClassification,
        healingAttempts: number,
        reason: string,
    ): EscalationEvent {
        return {
            taskId,
            agent,
            taskType,
            level: this.policy.defaultLevel,
            reason,
            failure,
            healingAttempts,
            timestamp: Date.now(),
        };
    }
}
