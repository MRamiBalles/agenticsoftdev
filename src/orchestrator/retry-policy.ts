/**
 * Retry Policy: Self-Healing & Circuit Breaker
 * 
 * Configurable retry logic with:
 *   - Per-task-type retry limits
 *   - Error feedback injection into retry payloads
 *   - Exponential backoff with jitter
 *   - Circuit breaker: halt after N consecutive failures
 * 
 * Phase 4.0: DAG Orchestration
 * Compliance: constitution.md Art. V (Structural Integrity)
 */

// ─── Types ───

export type TaskType = 'PLAN' | 'CODE' | 'AUDIT' | 'TEST' | 'REVIEW' | 'DEPLOY';

export interface RetryConfig {
    /** Max retries per task type */
    maxRetries: Record<TaskType, number>;
    /** Base delay in ms for exponential backoff */
    baseDelayMs: number;
    /** Maximum delay cap in ms */
    maxDelayMs: number;
    /** Consecutive failures before circuit breaker trips */
    circuitBreakerThreshold: number;
}

export interface RetryState {
    taskId: string;
    attempt: number;
    maxAttempts: number;
    lastError: string | null;
    lastErrorOutput: string | null;
    circuitOpen: boolean;
}

export interface RetryDecision {
    shouldRetry: boolean;
    delayMs: number;
    attempt: number;
    reason: string;
    feedbackPayload: Record<string, unknown> | null;
}

// ─── Defaults ───

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: {
        PLAN: 0,     // Plans are not retried — require human re-specification
        CODE: 2,     // Builder gets 2 retries with error feedback
        AUDIT: 0,    // Audits are deterministic — no retry
        TEST: 1,     // Tests get 1 retry (flaky test defense)
        REVIEW: 0,   // Reviews are human-gated
        DEPLOY: 0,   // Deploys require explicit re-approval
    },
    baseDelayMs: 500,
    maxDelayMs: 10000,
    circuitBreakerThreshold: 5,
};

// ─── Retry Policy ───

export class RetryPolicy {
    private config: RetryConfig;
    private taskAttempts: Map<string, number> = new Map();
    private consecutiveFailures: number = 0;
    private circuitOpen: boolean = false;

    constructor(config?: Partial<RetryConfig>) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            maxRetries: { ...DEFAULT_CONFIG.maxRetries, ...config?.maxRetries },
        };

        console.log('🔄 Retry Policy initialized.');
        console.log(`   Circuit breaker threshold: ${this.config.circuitBreakerThreshold}`);
    }

    /**
     * Records a task success. Resets consecutive failure counter.
     */
    public recordSuccess(taskId: string): void {
        this.consecutiveFailures = 0;
        this.taskAttempts.delete(taskId);
    }

    /**
     * Evaluates whether a failed task should be retried.
     * Returns a decision with delay and feedback payload.
     */
    public evaluate(params: {
        taskId: string;
        taskType: TaskType;
        errorMessage: string;
        errorOutput: string;
        originalPayload: Record<string, unknown>;
    }): RetryDecision {
        const { taskId, taskType, errorMessage, errorOutput, originalPayload } = params;

        // Circuit breaker check
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
            this.circuitOpen = true;
            return {
                shouldRetry: false,
                delayMs: 0,
                attempt: this.getAttempt(taskId),
                reason: `CIRCUIT BREAKER OPEN: ${this.consecutiveFailures} consecutive failures. Human intervention required.`,
                feedbackPayload: null,
            };
        }

        // Check max retries for this task type
        const maxRetries = this.config.maxRetries[taskType] ?? 0;
        const currentAttempt = this.getAttempt(taskId);

        if (currentAttempt >= maxRetries) {
            return {
                shouldRetry: false,
                delayMs: 0,
                attempt: currentAttempt,
                reason: `Max retries (${maxRetries}) exhausted for task type [${taskType}].`,
                feedbackPayload: null,
            };
        }

        // Increment attempt
        const nextAttempt = currentAttempt + 1;
        this.taskAttempts.set(taskId, nextAttempt);

        // Calculate delay with exponential backoff + jitter
        const delayMs = this.calculateDelay(nextAttempt);

        // Build feedback payload (inject error context for self-healing)
        const feedbackPayload = this.buildFeedbackPayload(
            originalPayload,
            errorMessage,
            errorOutput,
            nextAttempt,
            maxRetries,
        );

        return {
            shouldRetry: true,
            delayMs,
            attempt: nextAttempt,
            reason: `Retry ${nextAttempt}/${maxRetries} after ${delayMs}ms. Error feedback injected.`,
            feedbackPayload,
        };
    }

    /**
     * Returns the current state for a task.
     */
    public getState(taskId: string, taskType: TaskType): RetryState {
        return {
            taskId,
            attempt: this.getAttempt(taskId),
            maxAttempts: this.config.maxRetries[taskType] ?? 0,
            lastError: null,
            lastErrorOutput: null,
            circuitOpen: this.circuitOpen,
        };
    }

    /**
     * Returns whether the circuit breaker is open (system halted).
     */
    public isCircuitOpen(): boolean {
        return this.circuitOpen;
    }

    /**
     * Manually resets the circuit breaker (human intervention).
     */
    public resetCircuitBreaker(): void {
        this.circuitOpen = false;
        this.consecutiveFailures = 0;
        console.log('🔄 Circuit breaker RESET by human operator.');
    }

    // ─── Private Helpers ───

    private getAttempt(taskId: string): number {
        return this.taskAttempts.get(taskId) ?? 0;
    }

    private calculateDelay(attempt: number): number {
        // Exponential backoff: base * 2^attempt + random jitter
        const exponential = this.config.baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * this.config.baseDelayMs;
        return Math.min(exponential + jitter, this.config.maxDelayMs);
    }

    private buildFeedbackPayload(
        originalPayload: Record<string, unknown>,
        errorMessage: string,
        errorOutput: string,
        attempt: number,
        maxAttempts: number,
    ): Record<string, unknown> {
        return {
            ...originalPayload,
            _retry: {
                attempt,
                maxAttempts,
                previousError: errorMessage,
                previousOutput: errorOutput.slice(0, 2000), // Cap to avoid context bombing
                instruction: `RETRY ${attempt}/${maxAttempts}: The previous attempt failed with the error above. Fix the issue and try again. Do NOT repeat the same approach.`,
            },
        };
    }
}
