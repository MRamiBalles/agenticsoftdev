
import * as path from 'path';
import { SecurityGate, AgentRole } from './security-gate';
import { SandboxRuntime } from './sandbox-runtime';
import { ForensicLogger } from './forensic-logger';
import { RetrievalService } from './memory/retrieval-service';
import { IngestPipeline } from './memory/ingest-pipeline';
import { PlanningGate } from './memory/planning-gate';
import { ContextCompactor, SessionEvent } from './memory/context-compactor';
import { DAGEngine, DAGTask, DAGTaskResult, DAGGraph } from './dag-engine';
import { RetryPolicy } from './retry-policy';

/**
 * Agentic OS v5.0 - The Kernel
 * "Spec-Driven Graph Execution Engine"
 *
 * Phase 3: Security & Isolation Pipeline
 *   SecurityGate.validate() → SandboxRuntime.execute() → ForensicLogger.record()
 *
 * Phase 3.1: Institutional Memory (Protocolo Mnemosyne)
 *   PlanningGate.evaluate() → context injection → contradiction detection
 *
 * Phase 4.0: DAG Orchestration (El Motor Agéntico)
 *   Parallel execution → self-healing retry → circuit breaker
 */

class Orchestrator {
    // Phase 3: Security Infrastructure
    private gate: SecurityGate;
    private sandbox: SandboxRuntime;
    private logger: ForensicLogger;
    private projectRoot: string;

    // Phase 3.1: Institutional Memory
    private retrieval: RetrievalService;
    private ingestPipeline: IngestPipeline;
    private planningGate: PlanningGate;
    private compactor: ContextCompactor;
    private sessionEvents: SessionEvent[] = [];

    // Phase 4.0: DAG Orchestration
    private dagEngine: DAGEngine;
    private retryPolicy: RetryPolicy;

    constructor(projectRoot?: string) {
        this.projectRoot = projectRoot ?? path.resolve(__dirname, '..', '..');
        console.log("🦅 Agentic OS v5.0 Kernel Initializing...");

        // Initialize Security Pipeline (Phase 3)
        this.gate = new SecurityGate();
        this.sandbox = new SandboxRuntime(this.projectRoot);
        this.logger = new ForensicLogger(this.projectRoot);

        // Initialize Memory Pipeline (Phase 3.1)
        this.retrieval = new RetrievalService(this.projectRoot);
        this.ingestPipeline = new IngestPipeline({ projectRoot: this.projectRoot });
        this.planningGate = new PlanningGate(this.retrieval);
        this.compactor = new ContextCompactor(this.retrieval);

        // Initialize DAG Engine (Phase 4.0)
        this.retryPolicy = new RetryPolicy();
        this.dagEngine = new DAGEngine(
            { maxConcurrency: 3 },
            this.retryPolicy,
            {
                onDispatch: (task) => this.recordSessionEvent(task.agent, 'DISPATCH', `Task ${task.id} dispatched`),
                onComplete: (task, result) => this.recordSessionEvent(task.agent, 'COMPLETED', `Task ${task.id}: ${result.stdout.slice(0, 100)}`),
                onFail: (task, result) => this.recordSessionEvent(task.agent, 'FAILURE', `Task ${task.id}: ${result.stderr.slice(0, 100)}`),
                onRetry: (task, attempt, delayMs) => this.recordSessionEvent(task.agent, 'RETRY', `Task ${task.id} retry ${attempt} after ${delayMs}ms`),
                onCircuitBreak: () => this.recordSessionEvent('system', 'CIRCUIT_BREAK', 'Circuit breaker opened. Human intervention required.'),
            },
        );

        console.log("🛡️ Phase 3 Security Pipeline: ARMED");
        console.log("🧠 Phase 3.1 Memory Pipeline: ARMED");
        console.log("🕸️ Phase 4.0 DAG Engine: ARMED");
    }

    public async boot() {
        // 1. Load Institutional Memory (Constitution + ADRs)
        await this.loadContext();

        // 2. Build Task Graph (DAG)
        const graph = this.buildTaskGraph();

        // 3. Execute DAG through full pipeline
        await this.executeDAG(graph);
    }

    private async loadContext() {
        console.log("🧠 Loading Long-Term Memory (Constitution + ADRs)...");

        // Ingest institutional documents into vector store
        const { chunks, result } = await this.ingestPipeline.ingest();

        if (chunks.length > 0) {
            const ingested = this.retrieval.ingestChunks(chunks, 'architect');
            console.log(`🧠 Memory loaded: ${ingested} knowledge chunks indexed.`);
        } else if (result.skippedUnchanged > 0) {
            console.log(`🧠 Memory up-to-date: ${result.skippedUnchanged} documents unchanged.`);
        } else {
            console.warn('⚠️ No institutional documents found for indexing.');
        }

        // Log memory stats
        const stats = this.retrieval.getStats();
        console.log(`📊 Knowledge Base: ${stats.totalChunks} chunks | Sources: ${JSON.stringify(stats.bySourceType)}`);
    }

    /**
     * Builds the initial task graph.
     * In production, this comes from the Architect parsing spec.md.
     */
    private buildTaskGraph(): DAGGraph {
        console.log("🌱 Building Task Graph (DAG)...");
        return DAGEngine.buildGraph([
            { id: 'task_01', type: 'PLAN', agent: 'architect', payload: { goal: 'Design Folder Structure' } },
            { id: 'task_02', type: 'CODE', agent: 'builder', dependencies: ['task_01'], payload: { file: 'src/orchestrator/graph.ts' } },
            { id: 'task_03', type: 'AUDIT', agent: 'guardian', dependencies: ['task_02'], payload: { target: 'src/orchestrator/' } },
        ]);
    }

    /**
     * Executes the DAG through the full Phase 3/3.1/4.0 pipeline.
     */
    private async executeDAG(graph: DAGGraph): Promise<void> {
        // Validate graph integrity (Art. III.1: no cycles)
        const validation = this.dagEngine.validate(graph);
        if (!validation.valid) {
            for (const err of validation.errors) {
                console.error(`❌ Graph Error: ${err}`);
                this.logger.record({
                    agent_id: 'system',
                    trigger_event: 'DAG validation',
                    context_snapshot: err,
                    chain_of_thought: `Graph rejected: ${err}`,
                    action_type: 'PLAN_DECISION',
                    action_payload: { error: err },
                    outcome: 'BLOCKED',
                    governance_check_ref: 'ART_III_1',
                });
            }
            return;
        }

        // Execute with the secure dispatcher
        const result = await this.dagEngine.execute(graph, (task) => this.dispatchTask(task));

        // Log execution summary
        this.logger.record({
            agent_id: 'system',
            trigger_event: 'DAG execution complete',
            context_snapshot: JSON.stringify(result),
            chain_of_thought: `DAG: ${result.completed}/${result.totalTasks} completed, ${result.failed} failed, ${result.skipped} skipped, ${result.retries} retries in ${result.durationMs}ms`,
            action_type: 'PLAN_DECISION',
            action_payload: { ...result } as Record<string, unknown>,
            outcome: result.failed === 0 ? 'SUCCESS' : 'FAILURE',
        });

        if (result.circuitBroken) {
            console.error('🔴 Circuit breaker tripped. Manual reset required.');
        }
    }

    /**
     * Dispatches a single DAG task through the full security pipeline.
     * This is the TaskDispatcher callback for the DAG engine.
     *
     * Pipeline: PlanningGate → SecurityGate → SandboxRuntime → ForensicLogger
     */
    private async dispatchTask(task: DAGTask): Promise<DAGTaskResult> {
        console.log(`🚀 Dispatching [${task.id}] to Agent [${task.agent}]...`);

        // ── Phase 3.1: Planning Gate (Memory Consultation) ──
        if (task.type === 'PLAN') {
            const memoryResult = this.planningGate.quickConsult(
                task.payload,
                task.agent as AgentRole,
            );

            if (memoryResult.decision === 'INTERRUPT') {
                console.error(`🚨 Task [${task.id}] INTERRUPTED: ${memoryResult.reason}`);
                this.logger.record({
                    agent_id: task.agent,
                    trigger_event: `Task ${task.id} planning gate`,
                    context_snapshot: JSON.stringify(task.payload),
                    chain_of_thought: `Planning Gate INTERRUPT: ${memoryResult.reason}`,
                    action_type: 'PLAN_DECISION',
                    action_payload: { ...task.payload, contradictions: memoryResult.contradictions },
                    outcome: 'BLOCKED',
                    governance_check_ref: 'PLANNING_GATE',
                });
                return { exitCode: 1, stdout: '', stderr: `Planning Gate: ${memoryResult.reason}`, durationMs: 0 };
            }

            if (memoryResult.decision === 'PROCEED_WITH_CONTEXT') {
                task.payload = {
                    ...task.payload,
                    institutional_context: memoryResult.retrievedContext,
                    mandatory_constraints: memoryResult.mandatoryConstraints,
                };
                console.log(`🧠 Context injected: ${memoryResult.precedents.totalMatches} precedent(s)`);
            }
        }

        // ── Phase 3: Security Gate ──
        const verdict = this.gate.validate({
            agentRole: task.agent as AgentRole,
            taskType: task.type as 'PLAN' | 'CODE' | 'AUDIT',
            payload: task.payload,
            command: (task.payload as Record<string, unknown>)?.command as string | undefined,
        });

        if (!verdict.allowed) {
            console.error(`🚫 Task [${task.id}] BLOCKED: ${verdict.reason}`);
            this.logger.record({
                agent_id: task.agent,
                trigger_event: `Task ${task.id} dispatch`,
                context_snapshot: JSON.stringify(task.payload),
                chain_of_thought: `Gate blocked: ${verdict.reason}. Threats: ${verdict.threats.join('; ')}`,
                action_type: this.mapActionType(task.type),
                action_payload: task.payload,
                outcome: 'BLOCKED',
                governance_check_ref: `ATDI+${verdict.atdiPenalty}`,
            });
            return { exitCode: 1, stdout: '', stderr: `Security Gate: ${verdict.reason}`, durationMs: 0 };
        }

        // ── Phase 3: Sandbox Execution ──
        try {
            const taskScript = this.generateTaskScript(task, verdict.sanitizedPayload);
            const sandboxResult = this.sandbox.execute(taskScript, this.projectRoot);

            const cleanOutput = this.gate.sanitizeAgentOutput(sandboxResult.stdout);
            const cleanError = this.gate.sanitizeAgentOutput(sandboxResult.stderr);

            // Forensic Log
            this.logger.record({
                agent_id: task.agent,
                trigger_event: `Task ${task.id} dispatch`,
                context_snapshot: JSON.stringify(verdict.sanitizedPayload),
                chain_of_thought: `Sandbox [${sandboxResult.executionId.slice(0, 8)}]. Exit: ${sandboxResult.exitCode}. Timed out: ${sandboxResult.timedOut}`,
                action_type: this.mapActionType(task.type),
                action_payload: {
                    ...verdict.sanitizedPayload,
                    sandbox_execution_id: sandboxResult.executionId,
                    exit_code: sandboxResult.exitCode,
                    duration_ms: sandboxResult.durationMs,
                    timed_out: sandboxResult.timedOut,
                },
                outcome: sandboxResult.exitCode === 0 ? 'SUCCESS' : 'FAILURE',
            });

            return {
                exitCode: sandboxResult.exitCode,
                stdout: cleanOutput,
                stderr: cleanError,
                durationMs: sandboxResult.durationMs,
            };
        } catch (e) {
            const errorMsg = (e as Error).message;
            console.error(`❌ Task [${task.id}] Critical failure: ${errorMsg}`);

            this.logger.record({
                agent_id: task.agent,
                trigger_event: `Task ${task.id} dispatch`,
                context_snapshot: JSON.stringify(task.payload),
                chain_of_thought: `Unhandled error: ${errorMsg}`,
                action_type: 'SHELL_EXEC',
                action_payload: task.payload,
                outcome: 'FAILURE',
            });

            return { exitCode: 1, stdout: '', stderr: errorMsg, durationMs: 0 };
        }
    }

    /**
     * Generates a JavaScript task script for sandbox execution.
     */
    private generateTaskScript(task: DAGTask, sanitizedPayload: Record<string, unknown>): string {
        const payloadJson = JSON.stringify(sanitizedPayload);

        switch (task.type) {
            case 'PLAN':
                return `
                    const payload = ${payloadJson};
                    console.log('[Architect] Planning:', payload.goal || 'unknown');
                    console.log('Result: Plan generated.');
                `;
            case 'CODE':
                return `
                    const payload = ${payloadJson};
                    console.log('[Builder] Coding:', payload.file || 'unknown');
                    console.log('Result: Code generated.');
                `;
            case 'AUDIT':
            case 'TEST':
            case 'REVIEW':
                return `
                    const payload = ${payloadJson};
                    console.log('[Guardian] Auditing:', payload.target || 'unknown');
                    console.log('Result: Audit complete.');
                `;
            case 'RESEARCH':
                return `
                    const payload = ${payloadJson};
                    console.log('[Researcher] Investigating:', payload.query || payload.goal || 'unknown');
                    console.log('Result: Research report generated.');
                `;
            case 'DESIGN':
                return `
                    const payload = ${payloadJson};
                    console.log('[Designer] Designing:', payload.component || payload.target || 'unknown');
                    console.log('Result: Design artifacts generated.');
                `;
            case 'INFRA_PROVISION':
            case 'DEPLOY':
                return `
                    const payload = ${payloadJson};
                    console.log('[DevOps] Provisioning:', payload.target || payload.environment || 'unknown');
                    console.log('Result: Infrastructure provisioned.');
                `;
            default:
                return `console.error('Unknown task type: ${task.type}');process.exit(1)`;
        }
    }

    /**
     * Maps DAG task types to forensic log action types.
     */
    private mapActionType(taskType: string): 'PLAN_DECISION' | 'FILE_WRITE' | 'SHELL_EXEC' {
        switch (taskType) {
            case 'PLAN':
            case 'RESEARCH':
                return 'PLAN_DECISION';
            case 'CODE':
            case 'DESIGN':
                return 'FILE_WRITE';
            case 'AUDIT':
            case 'TEST':
            case 'REVIEW':
            case 'SHELL':
            case 'INFRA_PROVISION':
            case 'DEPLOY':
            default:
                return 'SHELL_EXEC';
        }
    }

    /**
     * Records a session event for later compaction.
     */
    private recordSessionEvent(agent: string, action: string, detail: string): void {
        this.sessionEvents.push({
            timestamp: new Date().toISOString(),
            agent,
            action,
            detail,
        });
    }

    /**
     * Compacts the current session's events into institutional memory.
     * Called at system shutdown.
     */
    public async compactSession(): Promise<void> {
        if (this.sessionEvents.length === 0) return;

        this.compactor.compact({
            sessionId: this.logger.getSessionId(),
            events: this.sessionEvents,
            writerRole: 'architect',
        });
    }
}

// Bootstrap
if (require.main === module) {
    const kernel = new Orchestrator();
    kernel.boot().then(() => kernel.compactSession());
}
