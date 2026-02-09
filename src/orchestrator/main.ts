
import * as fs from 'fs';
import * as path from 'path';
import { SecurityGate, AgentRole } from './security-gate';
import { SandboxRuntime } from './sandbox-runtime';
import { ForensicLogger } from './forensic-logger';

/**
 * Agentic OS v5.0 - The Kernel
 * "Spec-Driven Graph Execution Engine"
 *
 * Phase 3: Security & Isolation Pipeline
 *   SecurityGate.validate() → SandboxRuntime.execute() → ForensicLogger.record()
 */

interface TaskNode {
    id: string;
    type: 'PLAN' | 'CODE' | 'AUDIT';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    agent: string; // 'architect' | 'builder' | 'guardian'
    dependencies: string[];
    payload: any;
}

interface GraphState {
    tasks: Map<string, TaskNode>;
    context: Record<string, any>;
}

class Orchestrator {
    private state: GraphState = {
        tasks: new Map(),
        context: {}
    };

    // Phase 3: Security Infrastructure
    private gate: SecurityGate;
    private sandbox: SandboxRuntime;
    private logger: ForensicLogger;
    private projectRoot: string;

    constructor(projectRoot?: string) {
        this.projectRoot = projectRoot ?? path.resolve(__dirname, '..', '..');
        console.log("🦅 Agentic OS v5.0 Kernel Initializing...");

        // Initialize Security Pipeline
        this.gate = new SecurityGate();
        this.sandbox = new SandboxRuntime(this.projectRoot);
        this.logger = new ForensicLogger(this.projectRoot);

        console.log("🛡️ Phase 3 Security Pipeline: ARMED");
    }

    public async boot() {
        // 1. Load Memory (ADRs)
        await this.loadContext();

        // 2. Hydrate Graph (from spec/plan)
        // In a real run, this comes from 'Architect' parsing spec.md
        // For now, we seed a simple graph for "Operation Renaissance"
        this.seedInitialGraph();

        // 3. Main Event Loop
        await this.executeLoop();
    }

    private async loadContext() {
        console.log("🧠 Loading Long-Term Memory (ADRs)...");
        // TODO: Implement ADR Loader
    }

    private seedInitialGraph() {
        console.log("🌱 Seeding Task Graph...");
        this.state.tasks.set('task_01', {
            id: 'task_01',
            type: 'PLAN',
            status: 'PENDING',
            agent: 'architect',
            dependencies: [],
            payload: { goal: "Design Folder Structure" }
        });

        this.state.tasks.set('task_02', {
            id: 'task_02',
            type: 'CODE',
            status: 'PENDING',
            agent: 'builder',
            dependencies: ['task_01'],
            payload: { file: "src/orchestrator/graph.ts" }
        });
    }

    private async executeLoop() {
        console.log("🔄 Entering Execution Loop...");

        let running = true;
        while (running) {
            const pendingTasks = Array.from(this.state.tasks.values())
                .filter(t => t.status === 'PENDING');

            if (pendingTasks.length === 0) {
                console.log("✅ All tasks completed. System Shutdown.");
                running = false;
                break;
            }

            for (const task of pendingTasks) {
                // Check deps
                const canRun = task.dependencies.every(depId =>
                    this.state.tasks.get(depId)?.status === 'COMPLETED'
                );

                if (canRun) {
                    await this.dispatch(task);
                }
            }

            // Simple wait to prevent tight loop in demo
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private async dispatch(task: TaskNode) {
        console.log(`🚀 Dispatching Task [${task.id}] to Agent [${task.agent}]...`);
        task.status = 'RUNNING';

        // ── Phase 3: Security Pipeline ──

        // Step 1: Security Gate — validate before any execution
        const verdict = this.gate.validate({
            agentRole: task.agent as AgentRole,
            taskType: task.type,
            payload: task.payload,
            command: task.payload?.command,
        });

        if (!verdict.allowed) {
            console.error(`🚫 Task [${task.id}] BLOCKED by Security Gate: ${verdict.reason}`);
            task.status = 'FAILED';

            // Record the block in the forensic ledger
            this.logger.record({
                agent_id: task.agent,
                trigger_event: `Task ${task.id} dispatch`,
                context_snapshot: JSON.stringify(task.payload),
                chain_of_thought: `Gate blocked: ${verdict.reason}. Threats: ${verdict.threats.join('; ')}`,
                action_type: task.type === 'PLAN' ? 'PLAN_DECISION' : task.type === 'CODE' ? 'FILE_WRITE' : 'SHELL_EXEC',
                action_payload: task.payload,
                outcome: 'BLOCKED',
                governance_check_ref: `ATDI+${verdict.atdiPenalty}`,
            });
            return;
        }

        // Step 2: Sandbox Execution — run in ephemeral container
        try {
            const taskScript = this.generateTaskScript(task, verdict.sanitizedPayload);
            const sandboxResult = this.sandbox.execute(taskScript, this.projectRoot);

            // Step 3: Sanitize output — prevent secret leakage
            const cleanOutput = this.gate.sanitizeAgentOutput(sandboxResult.stdout);
            const cleanError = this.gate.sanitizeAgentOutput(sandboxResult.stderr);

            if (sandboxResult.exitCode === 0) {
                console.log(`🎉 Task [${task.id}] Completed (${sandboxResult.durationMs}ms): ${cleanOutput.slice(0, 200)}`);
                task.status = 'COMPLETED';
            } else {
                console.error(`❌ Task [${task.id}] Failed (exit ${sandboxResult.exitCode}): ${cleanError.slice(0, 200)}`);
                task.status = 'FAILED';
            }

            // Step 4: Forensic Log — record everything
            this.logger.record({
                agent_id: task.agent,
                trigger_event: `Task ${task.id} dispatch`,
                context_snapshot: JSON.stringify(verdict.sanitizedPayload),
                chain_of_thought: `Sandbox execution [${sandboxResult.executionId.slice(0, 8)}]. Exit: ${sandboxResult.exitCode}. Timed out: ${sandboxResult.timedOut}`,
                action_type: task.type === 'PLAN' ? 'PLAN_DECISION' : task.type === 'CODE' ? 'FILE_WRITE' : 'SHELL_EXEC',
                action_payload: {
                    ...verdict.sanitizedPayload,
                    sandbox_execution_id: sandboxResult.executionId,
                    exit_code: sandboxResult.exitCode,
                    duration_ms: sandboxResult.durationMs,
                    timed_out: sandboxResult.timedOut,
                },
                outcome: sandboxResult.exitCode === 0 ? 'SUCCESS' : 'FAILURE',
            });

        } catch (e) {
            console.error(`❌ Task [${task.id}] Critical failure:`, (e as Error).message);
            task.status = 'FAILED';

            this.logger.record({
                agent_id: task.agent,
                trigger_event: `Task ${task.id} dispatch`,
                context_snapshot: JSON.stringify(task.payload),
                chain_of_thought: `Unhandled error: ${(e as Error).message}`,
                action_type: 'SHELL_EXEC',
                action_payload: task.payload,
                outcome: 'FAILURE',
            });
        }
    }

    /**
     * Generates a JavaScript task script for sandbox execution.
     * Maps task type to executable code.
     */
    private generateTaskScript(task: TaskNode, sanitizedPayload: Record<string, unknown>): string {
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
                return `
                    const payload = ${payloadJson};
                    console.log('[Guardian] Auditing:', payload.target || 'unknown');
                    console.log('Result: Audit complete.');
                `;
            default:
                return `console.error('Unknown task type: ${task.type}');process.exit(1);`;
        }
    }
}

// Bootstrap
if (require.main === module) {
    const kernel = new Orchestrator();
    kernel.boot();
}
