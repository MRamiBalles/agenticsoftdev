
import * as path from 'path';
import { SecurityGate, AgentRole } from './security-gate';
import { SandboxRuntime } from './sandbox-runtime';
import { ForensicLogger } from './forensic-logger';
import { RetrievalService } from './memory/retrieval-service';
import { IngestPipeline } from './memory/ingest-pipeline';
import { PlanningGate } from './memory/planning-gate';
import { ContextCompactor, SessionEvent } from './memory/context-compactor';
import { DAGEngine, DAGTask, DAGTaskResult, DAGGraph, TaskDispatchResult } from './dag-engine';
import { EventBus, AgentMailbox } from './agent-bus';
import { RetryPolicy, TaskType } from './retry-policy';
import { NegotiationEngine, TaskAuction } from './agent-negotiation';
import { OutcomeTracker, AdaptationEngine, TaskOutcome } from './agent-learning';
import { CheckpointManager } from './execution-persistence';
import { WorkerRegistry, LoadBalancer } from './distributed-executor';
import { FailureDetector, HealingEngine } from './agent-self-healing';
import { ATDIEngine } from './atdi-engine';
import { SpecDriftDetector } from './spec-drift-detector';

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
 *
 * Phase 4.1: Dynamic Graph Mutation
 *   Runtime task spawning → context isolation → recursion depth limits
 *
 * Phase 4.2: Agent Communication Protocol
 *   EventBus pub/sub → RBAC → forensic logging
 *
 * Phase 4.3: Agent Negotiation Protocol
 *   NegotiationEngine → TaskAuction → consensus strategies
 *
 * Phase 4.4: Agent Learning & Adaptation
 *   OutcomeTracker → AdaptationEngine → bid calibration → retry tuning
 *
 * Phase 4.5: Persistent Execution State
 *   CheckpointManager → SHA-256 integrity → partial restore
 *
 * Phase 4.6: Distributed Execution
 *   WorkerRegistry → LoadBalancer → failover
 *
 * Phase 4.7: Agent Self-Healing
 *   FailureDetector → HealingEngine → escalation
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

    // Phase 4.2: Agent Communication
    private eventBus: EventBus;

    // Phase 4.3: Agent Negotiation
    private negotiationEngine: NegotiationEngine;
    private taskAuction: TaskAuction;

    // Phase 4.4: Agent Learning & Adaptation
    private outcomeTracker: OutcomeTracker;
    private adaptationEngine: AdaptationEngine;

    // Phase 4.5: Persistent Execution State
    private checkpointManager: CheckpointManager;

    // Phase 4.6: Distributed Execution
    private workerRegistry: WorkerRegistry;

    // Phase 4.7: Agent Self-Healing
    private failureDetector: FailureDetector;
    private healingEngine: HealingEngine;

    // Phase 5: ATDI Quality Engine
    private atdiEngine: ATDIEngine;

    // Phase 6: Spec Drift Detection
    private specDriftDetector: SpecDriftDetector;

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
                onComplete: (task, result) => {
                    this.recordSessionEvent(task.agent, 'COMPLETED', `Task ${task.id}: ${result.stdout.slice(0, 100)}`);
                    // Phase 4.4: Record success outcome for learning
                    this.recordTaskOutcome(task, result, true);
                    // Phase 4.5: Auto-checkpoint trigger
                    this.triggerAutoCheckpoint(task);
                },
                onFail: (task, result) => {
                    this.recordSessionEvent(task.agent, 'FAILURE', `Task ${task.id}: ${result.stderr.slice(0, 100)}`);
                    // Phase 4.4: Record failure outcome for learning
                    this.recordTaskOutcome(task, result, false);
                    // Phase 4.7: Attempt self-healing
                    this.attemptSelfHealing(task, result);
                },
                onRetry: (task, attempt, delayMs) => this.recordSessionEvent(task.agent, 'RETRY', `Task ${task.id} retry ${attempt} after ${delayMs}ms`),
                onCircuitBreak: () => this.recordSessionEvent('system', 'CIRCUIT_BREAK', 'Circuit breaker opened. Human intervention required.'),
                onSpawn: (parent, child) => this.recordSessionEvent(parent.agent, 'SPAWN', `Task ${parent.id} spawned ${child.id} (depth ${child.depth})`),
                onSpawnRejected: (parent, req, reason) => this.recordSessionEvent(parent.agent, 'SPAWN_REJECTED', `Task ${parent.id} spawn [${req.id}] rejected: ${reason}`),
            },
        );

        // Initialize Agent Communication (Phase 4.2)
        this.eventBus = new EventBus(
            { maxMessageSize: 10240, maxChannelDepth: 100, defaultTtlMs: 60000 },
            {
                onPublish: (msg) => {
                    this.logger.record({
                        agent_id: msg.sender,
                        trigger_event: `Message published: ${msg.topic}`,
                        context_snapshot: JSON.stringify(msg.payload).slice(0, 500),
                        chain_of_thought: `Bus message [${msg.id}] topic=${msg.topic} target=${msg.target ?? 'broadcast'}`,
                        action_type: 'PLAN_DECISION',
                        action_payload: { messageId: msg.id, topic: msg.topic, target: msg.target },
                        outcome: 'SUCCESS',
                    });
                },
                onReject: (sender, topic, reason) => {
                    this.logger.record({
                        agent_id: sender,
                        trigger_event: `Message rejected: ${topic}`,
                        context_snapshot: reason,
                        chain_of_thought: `Bus rejection: ${reason}`,
                        action_type: 'PLAN_DECISION',
                        action_payload: { topic, reason },
                        outcome: 'BLOCKED',
                    });
                },
            },
        );

        // Initialize Negotiation Protocol (Phase 4.3)
        this.negotiationEngine = new NegotiationEngine({}, this.eventBus);
        this.taskAuction = new TaskAuction({}, this.eventBus);

        // Initialize Learning & Adaptation (Phase 4.4)
        this.outcomeTracker = new OutcomeTracker({}, {
            onOutcomeRecorded: (outcome) => this.recordSessionEvent(outcome.agent, 'OUTCOME', `${outcome.taskType} ${outcome.success ? 'SUCCESS' : 'FAIL'} in ${outcome.durationMs}ms`),
        });
        this.adaptationEngine = new AdaptationEngine(this.outcomeTracker, {}, {
            onRecommendation: (rec) => this.recordSessionEvent('system', 'ADAPTATION', `${rec.type}: ${rec.description}`),
        });

        // Initialize Persistent Execution State (Phase 4.5)
        this.checkpointManager = new CheckpointManager(
            { autoCheckpointInterval: 5, maxCheckpoints: 10, verifyOnLoad: true },
            {
                onCheckpointSaved: (ckpt) => {
                    this.recordSessionEvent('system', 'CHECKPOINT', `Saved ${ckpt.snapshot.id} (${ckpt.sizeBytes} bytes)`);
                    this.logger.record({
                        agent_id: 'system',
                        trigger_event: 'Checkpoint saved',
                        context_snapshot: `id=${ckpt.snapshot.id} hash=${ckpt.hash.slice(0, 16)}...`,
                        chain_of_thought: `Checkpoint ${ckpt.snapshot.id}: ${ckpt.snapshot.graph.tasks.length} tasks, ${ckpt.sizeBytes} bytes`,
                        action_type: 'PLAN_DECISION',
                        action_payload: { checkpointId: ckpt.snapshot.id, hash: ckpt.hash },
                        outcome: 'SUCCESS',
                    });
                },
                onIntegrityViolation: (id, expected, actual) => {
                    console.error(`🔴 Checkpoint integrity violation: ${id}`);
                    this.logger.record({
                        agent_id: 'system',
                        trigger_event: 'Checkpoint integrity violation',
                        context_snapshot: `expected=${expected.slice(0, 16)} actual=${actual.slice(0, 16)}`,
                        chain_of_thought: `INTEGRITY_VIOLATION on checkpoint ${id}`,
                        action_type: 'SHELL_EXEC',
                        action_payload: { checkpointId: id, expected, actual },
                        outcome: 'BLOCKED',
                    });
                },
            },
        );

        // Initialize Distributed Execution (Phase 4.6)
        this.workerRegistry = new WorkerRegistry(
            { heartbeatIntervalMs: 5000, missedHeartbeatsThreshold: 3 },
            {
                onWorkerDead: (worker) => {
                    this.recordSessionEvent('system', 'WORKER_DEAD', `Worker ${worker.id} marked DEAD`);
                    this.logger.record({
                        agent_id: 'system',
                        trigger_event: 'Worker death detected',
                        context_snapshot: `worker=${worker.id} lastHeartbeat=${worker.lastHeartbeat}`,
                        chain_of_thought: `Worker ${worker.id} missed heartbeat threshold`,
                        action_type: 'SHELL_EXEC',
                        action_payload: { workerId: worker.id, status: worker.status },
                        outcome: 'FAILURE',
                    });
                },
            },
        );

        // Initialize Self-Healing (Phase 4.7)
        this.failureDetector = new FailureDetector();
        this.healingEngine = new HealingEngine(undefined, undefined, {
            onHealingAttempt: (record) => {
                this.recordSessionEvent(record.agent, 'HEAL_ATTEMPT', `${record.actionTaken} for ${record.failure.category} (attempt ${record.attempt})`);
            },
            onHealingSuccess: (record) => {
                this.recordSessionEvent(record.agent, 'HEAL_SUCCESS', `${record.actionTaken} healed ${record.taskId}`);
                this.logger.record({
                    agent_id: record.agent,
                    trigger_event: `Self-healing success: ${record.taskId}`,
                    context_snapshot: `action=${record.actionTaken} category=${record.failure.category}`,
                    chain_of_thought: `Healed ${record.taskId} via ${record.actionTaken} after ${record.attempt} attempt(s)`,
                    action_type: 'SHELL_EXEC',
                    action_payload: { taskId: record.taskId, action: record.actionTaken, category: record.failure.category },
                    outcome: 'SUCCESS',
                });
            },
            onEscalation: (event) => {
                console.error(`🚨 Escalation [${event.level}]: ${event.reason}`);
                this.recordSessionEvent(event.agent, 'ESCALATION', `${event.level}: ${event.reason}`);
                this.logger.record({
                    agent_id: event.agent,
                    trigger_event: `Escalation: ${event.taskId}`,
                    context_snapshot: event.reason,
                    chain_of_thought: `Escalation ${event.level} for ${event.taskId}: ${event.reason}`,
                    action_type: 'PLAN_DECISION',
                    action_payload: { taskId: event.taskId, level: event.level, reason: event.reason },
                    outcome: 'BLOCKED',
                });
            },
        });

        // Initialize ATDI Quality Engine (Phase 5)
        this.atdiEngine = new ATDIEngine({}, {}, {
            onAnalysisComplete: (report) => {
                this.recordSessionEvent('system', 'ATDI_ANALYSIS', `Score: ${report.score} (${report.trafficLight}), ${report.smells.length} smells`);
                this.logger.record({
                    agent_id: 'system',
                    trigger_event: 'ATDI analysis complete',
                    context_snapshot: `score=${report.score} light=${report.trafficLight} smells=${report.smells.length}`,
                    chain_of_thought: `ATDI: ${report.score} (${report.trafficLight}). ${report.smells.map(s => s.description).join('; ')}`.slice(0, 500),
                    action_type: 'PLAN_DECISION',
                    action_payload: { score: report.score, trafficLight: report.trafficLight, smellCount: report.smells.length, blocked: report.blocked },
                    outcome: report.blocked ? 'BLOCKED' : 'SUCCESS',
                });
            },
            onDeployBlocked: (report) => {
                console.error(`🔴 ATDI Deploy BLOCKED: score ${report.score} (${report.trafficLight})`);
                this.recordSessionEvent('system', 'ATDI_BLOCK', `Deploy blocked: ATDI ${report.score} >= RED threshold`);
            },
        });

        console.log("🛡️ Phase 3 Security Pipeline: ARMED");
        console.log("🧠 Phase 3.1 Memory Pipeline: ARMED");
        console.log("🕸️ Phase 4.0 DAG Engine: ARMED");
        console.log("📡 Phase 4.2 Agent Bus: ARMED");
        console.log("🤝 Phase 4.3 Negotiation Protocol: ARMED");
        console.log("📈 Phase 4.4 Learning & Adaptation: ARMED");
        console.log("💾 Phase 4.5 Persistent State: ARMED");
        console.log("🌐 Phase 4.6 Distributed Execution: ARMED");
        console.log("🩹 Phase 4.7 Self-Healing: ARMED");
        console.log("📊 Phase 5 ATDI Quality Engine: ARMED");

        // Initialize Spec Drift Detector (Phase 6)
        this.specDriftDetector = new SpecDriftDetector({}, {
            onDriftDetected: (alert) => {
                console.warn(`📐 Drift [${alert.severity}] ${alert.featureId}: ${alert.message}`);
                this.recordSessionEvent('system', 'SPEC_DRIFT', `${alert.severity}: ${alert.message}`);
                this.logger.record({
                    agent_id: 'system',
                    trigger_event: `Spec drift: ${alert.featureId}`,
                    context_snapshot: alert.message,
                    chain_of_thought: `Drift detected for ${alert.featureId}: ${alert.message}`,
                    action_type: 'PLAN_DECISION',
                    action_payload: { featureId: alert.featureId, severity: alert.severity },
                    outcome: alert.severity === 'CRITICAL' ? 'BLOCKED' : 'SUCCESS',
                });
            },
            onAligned: (featureId) => {
                this.recordSessionEvent('system', 'SPEC_ALIGNED', `Feature ${featureId} aligned`);
            },
        });

        console.log("📐 Phase 6 Spec Drift Detector: ARMED");
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
     * Executes the DAG through the full Phase 3–4.7 pipeline.
     */
    private async executeDAG(graph: DAGGraph): Promise<void> {
        // Phase 4.5: Set graph reference for auto-checkpoints
        this.currentGraph = graph;
        this.executionOrder = [];

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

        // Execute with the mutating dispatcher (Phase 4.1)
        const result = await this.dagEngine.executeMutating(
            graph,
            (task) => this.dispatchTask(task),
            { maxDepth: 3, maxGraphSize: 50 },
        );

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

        // Phase 4.5: Final checkpoint after execution
        this.checkpointManager.save(
            graph, this.executionOrder,
            result.retries, result.spawned, [], [],
            result.durationMs, 'execution-complete',
        );

        // Phase 4.4: Generate adaptation recommendations for all agents
        const agents = new Set<string>();
        for (const [, task] of graph.tasks) {
            agents.add(task.agent);
        }
        for (const agent of agents) {
            const recs = this.adaptationEngine.recommend(agent, agent as AgentRole);
            for (const rec of recs) {
                console.log(`📈 Adaptation [${agent}]: ${rec.type} — ${rec.description} (confidence: ${rec.confidence.toFixed(2)})`);
            }
        }

        // Phase 4.5: Clear graph reference
        this.currentGraph = undefined;
    }

    /**
     * Dispatches a single DAG task through the full security pipeline.
     * This is the TaskDispatcher callback for the DAG engine.
     *
     * Pipeline: PlanningGate → SecurityGate → SandboxRuntime → ForensicLogger
     */
    private async dispatchTask(task: DAGTask): Promise<TaskDispatchResult> {
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
                return { result: { exitCode: 1, stdout: '', stderr: `Planning Gate: ${memoryResult.reason}`, durationMs: 0 } };
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

        // ── Phase 5: ATDI Deploy Gate ──
        if (task.type === 'DEPLOY' || task.type === 'INFRA_PROVISION') {
            const gate = this.atdiEngine.checkDeployGate();
            if (!gate.allowed) {
                console.error(`🔴 Task [${task.id}] BLOCKED by ATDI: ${gate.reason}`);
                this.logger.record({
                    agent_id: task.agent,
                    trigger_event: `Task ${task.id} ATDI gate`,
                    context_snapshot: JSON.stringify(task.payload),
                    chain_of_thought: `ATDI Gate: ${gate.reason}`,
                    action_type: 'PLAN_DECISION',
                    action_payload: { ...task.payload, atdiScore: gate.score, trafficLight: gate.trafficLight },
                    outcome: 'BLOCKED',
                    governance_check_ref: 'ATDI_GATE',
                });
                return { result: { exitCode: 1, stdout: '', stderr: `ATDI Gate: ${gate.reason}`, durationMs: 0 } };
            }
            if (gate.trafficLight === 'AMBER') {
                console.warn(`⚠️ Task [${task.id}] ATDI WARNING: ${gate.reason}`);
                task.payload = { ...task.payload, atdi_warning: gate.reason, atdi_score: gate.score };
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
            return { result: { exitCode: 1, stdout: '', stderr: `Security Gate: ${verdict.reason}`, durationMs: 0 } };
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
                result: {
                    exitCode: sandboxResult.exitCode,
                    stdout: cleanOutput,
                    stderr: cleanError,
                    durationMs: sandboxResult.durationMs,
                },
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

            return { result: { exitCode: 1, stdout: '', stderr: errorMsg, durationMs: 0 } };
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

    // ─── Phase 4.4: Learning Feedback ───

    /**
     * Records a task outcome into the OutcomeTracker for learning.
     */
    private recordTaskOutcome(task: DAGTask, result: DAGTaskResult, success: boolean): void {
        const outcome: TaskOutcome = {
            agent: task.agent,
            agentRole: task.agent as AgentRole,
            taskType: task.type,
            taskId: task.id,
            success,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            retryCount: task.retryCount,
            depth: task.depth,
            timestamp: Date.now(),
            errorPattern: success ? undefined : result.stderr.slice(0, 200),
        };
        this.outcomeTracker.record(outcome);
    }

    // ─── Phase 4.5: Auto-Checkpoint ───

    /** Current execution graph reference (set during executeDAG) */
    private currentGraph?: DAGGraph;
    private executionOrder: string[] = [];

    /**
     * Triggers an auto-checkpoint if the interval threshold is met.
     */
    private triggerAutoCheckpoint(task: DAGTask): void {
        if (!this.currentGraph) return;
        this.executionOrder.push(task.id);

        if (this.checkpointManager.notifyTaskCompleted()) {
            this.checkpointManager.save(
                this.currentGraph,
                this.executionOrder,
                0, 0, [], [],
                Date.now(),
            );
        }
    }

    // ─── Phase 4.7: Self-Healing ───

    /**
     * Attempts to self-heal a failed task using the FailureDetector + HealingEngine.
     */
    private attemptSelfHealing(task: DAGTask, result: DAGTaskResult): void {
        const classification = this.failureDetector.classify(result, result.durationMs);

        // Fire-and-forget: healing is async but DAG callbacks are sync.
        // The healing result is logged via HealingEngine callbacks (configured in constructor).
        this.healingEngine.heal(
            task.id,
            task.agent,
            task.type,
            classification,
            async (_taskId, action, _failure) => {
                // Healing executor: attempt a re-dispatch through the sandbox
                try {
                    const retryResult = await this.dispatchTask(task);
                    return retryResult.result.exitCode === 0;
                } catch {
                    return false;
                }
            },
        ).catch((err) => {
            console.error(`❌ Self-healing error for ${task.id}: ${(err as Error).message}`);
        });
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
