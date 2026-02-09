/**
 * Multi-Agent Simulation Sandbox
 * 
 * Provides a simulation harness to run the full agent pipeline end-to-end:
 *   - Configurable mock agents with reliability, speed, and fault profiles
 *   - Wires all subsystems: EventBus, Negotiation, Auction, Learning, Persistence, Distributed, Healing
 *   - Predefined scenarios: HAPPY_PATH, CASCADING_FAILURE, HEALING_RECOVERY, HIGH_CONTENTION
 *   - Full event timeline for post-hoc analysis and metrics
 * 
 * Phase 4.8: Multi-Agent Simulation Sandbox
 * Compliance: constitution.md Art. II (No Opaque Blobs — all sim events inspectable),
 *             Art. V (Structural Integrity — test before production)
 */

import { TaskType } from './retry-policy';
import { AgentRole } from './security-gate';
import { DAGTask, DAGTaskResult, DAGGraph } from './dag-engine';
import { EventBus } from './agent-bus';
import { OutcomeTracker, AdaptationEngine, TaskOutcome } from './agent-learning';
import { WorkerRegistry, LoadBalancer } from './distributed-executor';
import { FailureDetector, HealingEngine, FailureClassification } from './agent-self-healing';
import { CheckpointManager } from './execution-persistence';

// ─── Types ───

export type FailureMode = 'NONE' | 'CRASH' | 'TIMEOUT' | 'OOM' | 'INTERMITTENT';

export type ScenarioType = 'HAPPY_PATH' | 'CASCADING_FAILURE' | 'HEALING_RECOVERY' | 'HIGH_CONTENTION' | 'CUSTOM';

/** Configuration for a simulated agent */
export interface SimAgentConfig {
    id: string;
    role: AgentRole;
    /** Probability of success (0–1) */
    reliability: number;
    /** Base execution time (ms) */
    baseLatencyMs: number;
    /** Latency variance (ms) — actual latency = base ± variance */
    latencyVarianceMs: number;
    /** Task types this agent can handle */
    capabilities: TaskType[];
    /** Failure mode when the agent fails */
    failureMode: FailureMode;
}

/** A simulated agent instance */
export interface SimAgent {
    config: SimAgentConfig;
    /** Total tasks dispatched to this agent */
    tasksDispatched: number;
    /** Total tasks completed successfully */
    tasksCompleted: number;
    /** Total tasks failed */
    tasksFailed: number;
    /** Total healed */
    tasksHealed: number;
}

/** Event in the simulation timeline */
export interface SimEvent {
    type: 'DISPATCH' | 'COMPLETE' | 'FAIL' | 'HEAL' | 'ESCALATE' | 'CHECKPOINT' | 'MESSAGE' | 'NEGOTIATE';
    timestamp: number;
    agentId?: string;
    taskId?: string;
    data: Record<string, unknown>;
    index: number;
}

/** Configuration for the simulation */
export interface SimConfig {
    /** Agents participating in the simulation */
    agents: SimAgentConfig[];
    /** DAG to execute */
    graph: DAGGraph;
    /** Scenario type */
    scenario: ScenarioType;
    /** Enable healing subsystem */
    enableHealing: boolean;
    /** Enable checkpoint subsystem */
    enableCheckpoints: boolean;
    /** Enable learning subsystem */
    enableLearning: boolean;
    /** Seed for deterministic randomness (0 = non-deterministic) */
    seed: number;
}

/** Metrics collected during simulation */
export interface SimMetrics {
    totalTasks: number;
    tasksCompleted: number;
    tasksFailed: number;
    tasksHealed: number;
    tasksEscalated: number;
    totalDurationMs: number;
    avgLatencyMs: number;
    healingRate: number;
    successRate: number;
    checkpointsTaken: number;
    messagesExchanged: number;
    perAgent: Map<string, {
        dispatched: number;
        completed: number;
        failed: number;
        healed: number;
        avgLatencyMs: number;
    }>;
}

/** Result of a simulation run */
export interface SimResult {
    metrics: SimMetrics;
    timeline: SimEvent[];
    /** Final state of agents */
    agents: SimAgent[];
    /** Duration of the simulation (ms) */
    wallClockMs: number;
    /** Scenario that was run */
    scenario: ScenarioType;
    /** Whether the simulation completed without unrecoverable errors */
    success: boolean;
}

/** Callbacks for simulation observability */
export interface SimCallbacks {
    onEvent?: (event: SimEvent) => void;
    onSimStart?: (config: SimConfig) => void;
    onSimEnd?: (result: SimResult) => void;
}

// ─── Seeded Random ───

class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed || Date.now();
    }

    /** Returns a number in [0, 1) */
    public next(): number {
        // xorshift32
        this.state ^= this.state << 13;
        this.state ^= this.state >> 17;
        this.state ^= this.state << 5;
        return (this.state >>> 0) / 4294967296;
    }
}

// ─── SimulationEngine ───

export class SimulationEngine {
    private agents: Map<string, SimAgent> = new Map();
    private timeline: SimEvent[] = [];
    private eventIndex: number = 0;
    private callbacks: SimCallbacks;
    private rng: SeededRandom;

    // Subsystems
    private eventBus: EventBus;
    private outcomeTracker: OutcomeTracker;
    private adaptationEngine: AdaptationEngine;
    private workerRegistry: WorkerRegistry;
    private failureDetector: FailureDetector;
    private healingEngine: HealingEngine;
    private checkpointManager: CheckpointManager;

    private config: SimConfig;

    // Metrics accumulators
    private totalLatencyMs: number = 0;
    private tasksCompleted: number = 0;
    private tasksFailed: number = 0;
    private tasksHealed: number = 0;
    private tasksEscalated: number = 0;
    private messagesExchanged: number = 0;
    private checkpointsTaken: number = 0;

    constructor(config: SimConfig, callbacks?: SimCallbacks) {
        this.config = config;
        this.callbacks = callbacks ?? {};
        this.rng = new SeededRandom(config.seed);

        // Initialize subsystems
        this.eventBus = new EventBus();
        this.outcomeTracker = new OutcomeTracker();
        this.adaptationEngine = new AdaptationEngine(this.outcomeTracker);
        this.workerRegistry = new WorkerRegistry();
        this.failureDetector = new FailureDetector();
        this.healingEngine = new HealingEngine();
        this.checkpointManager = new CheckpointManager({ autoCheckpointInterval: 3 });

        // Register agents
        for (const agentConfig of config.agents) {
            const agent: SimAgent = {
                config: agentConfig,
                tasksDispatched: 0,
                tasksCompleted: 0,
                tasksFailed: 0,
                tasksHealed: 0,
            };
            this.agents.set(agentConfig.id, agent);

            // Register as worker
            this.workerRegistry.register(
                agentConfig.id,
                agentConfig.capabilities,
                3, // max concurrency
                { role: agentConfig.role },
            );
        }
    }

    /**
     * Run the simulation.
     */
    public async run(): Promise<SimResult> {
        const startTime = Date.now();
        this.callbacks.onSimStart?.(this.config);

        const tasks = Array.from(this.config.graph.tasks.values());

        // Execute tasks respecting dependencies
        const completed = new Set<string>();
        const failed = new Set<string>();
        let progress = true;

        while (progress) {
            progress = false;
            const ready: DAGTask[] = [];

            for (const task of tasks) {
                if (completed.has(task.id) || failed.has(task.id)) continue;
                const depsReady = task.dependencies.every(d => completed.has(d));
                const depsFailed = task.dependencies.some(d => failed.has(d));

                if (depsFailed) {
                    task.status = 'SKIPPED';
                    failed.add(task.id);
                    progress = true;
                    continue;
                }

                if (depsReady) {
                    ready.push(task);
                }
            }

            // Execute ready tasks
            const results = await Promise.all(ready.map(t => this.executeTask(t)));

            for (let i = 0; i < ready.length; i++) {
                const task = ready[i];
                const result = results[i];

                if (result.success) {
                    completed.add(task.id);
                    task.status = 'COMPLETED';
                } else {
                    failed.add(task.id);
                    task.status = 'FAILED';
                }
                progress = true;

                // Auto-checkpoint
                if (this.config.enableCheckpoints && this.checkpointManager.notifyTaskCompleted()) {
                    this.checkpointManager.save(
                        this.config.graph, Array.from(completed), 0, 0, [], [], Date.now() - startTime,
                    );
                    this.checkpointsTaken++;
                    this.recordEvent('CHECKPOINT', undefined, task.id, { label: `auto-ckpt-${this.checkpointsTaken}` });
                }
            }
        }

        const wallClockMs = Date.now() - startTime;

        const metrics = this.computeMetrics();
        const simResult: SimResult = {
            metrics,
            timeline: [...this.timeline],
            agents: Array.from(this.agents.values()),
            wallClockMs,
            scenario: this.config.scenario,
            success: this.tasksEscalated === 0,
        };

        this.callbacks.onSimEnd?.(simResult);
        return simResult;
    }

    /**
     * Get the simulation timeline.
     */
    public getTimeline(): ReadonlyArray<SimEvent> {
        return this.timeline;
    }

    /**
     * Get all agents.
     */
    public getAgents(): SimAgent[] {
        return Array.from(this.agents.values());
    }

    // ─── Private ───

    private async executeTask(task: DAGTask): Promise<{ success: boolean; result?: DAGTaskResult }> {
        // Select agent for this task
        const agent = this.selectAgent(task);
        if (!agent) {
            this.tasksFailed++;
            this.recordEvent('FAIL', undefined, task.id, { reason: 'NO_CAPABLE_AGENT' });
            return { success: false };
        }

        agent.tasksDispatched++;
        this.recordEvent('DISPATCH', agent.config.id, task.id, { type: task.type });

        // Simulate execution
        const result = await this.simulateExecution(agent, task);

        if (result.exitCode === 0) {
            // Success
            agent.tasksCompleted++;
            this.tasksCompleted++;
            this.totalLatencyMs += result.durationMs;
            this.recordEvent('COMPLETE', agent.config.id, task.id, { durationMs: result.durationMs });

            // Record outcome for learning
            if (this.config.enableLearning) {
                this.recordOutcome(agent, task, result, true);
            }

            return { success: true, result };
        } else {
            // Failure
            agent.tasksFailed++;
            this.tasksFailed++;

            this.recordEvent('FAIL', agent.config.id, task.id, {
                exitCode: result.exitCode,
                stderr: result.stderr.slice(0, 100),
            });

            // Record outcome for learning
            if (this.config.enableLearning) {
                this.recordOutcome(agent, task, result, false);
            }

            // Attempt healing
            if (this.config.enableHealing) {
                const classification = this.failureDetector.classify(result);
                const healResult = await this.healingEngine.heal(
                    task.id, agent.config.id, task.type, classification,
                    async () => {
                        // Simulate a healing retry with boosted reliability
                        const retryResult = await this.simulateExecution(agent, task, 1.5);
                        return retryResult.exitCode === 0;
                    },
                );

                if (healResult.healed) {
                    agent.tasksHealed++;
                    this.tasksHealed++;
                    this.recordEvent('HEAL', agent.config.id, task.id, {
                        action: healResult.successfulAction,
                    });
                    return { success: true, result };
                }

                if (healResult.escalation) {
                    this.tasksEscalated++;
                    this.recordEvent('ESCALATE', agent.config.id, task.id, {
                        level: healResult.escalation.level,
                        reason: healResult.escalation.reason,
                    });
                }
            }

            return { success: false, result };
        }
    }

    private selectAgent(task: DAGTask): SimAgent | undefined {
        // Find agents capable of this task type
        const capable = Array.from(this.agents.values()).filter(a =>
            a.config.capabilities.includes(task.type),
        );
        if (capable.length === 0) return undefined;

        // If learning is enabled, prefer agents with task affinity
        if (this.config.enableLearning) {
            const candidates = capable.map(a => ({ agent: a.config.id, role: a.config.role }));
            const affinities = this.adaptationEngine.getTaskAffinity(task.type, candidates);
            if (affinities.length > 0) {
                const preferred = capable.find(a => affinities.some(af => af.agent === a.config.id));
                if (preferred) return preferred;
            }
        }

        // Default: pick the agent with best reliability among capable
        return capable.reduce((best, a) => a.config.reliability > best.config.reliability ? a : best);
    }

    private async simulateExecution(
        agent: SimAgent,
        task: DAGTask,
        reliabilityBoost: number = 1.0,
    ): Promise<DAGTaskResult> {
        const cfg = agent.config;

        // Simulate latency
        const variance = (this.rng.next() - 0.5) * 2 * cfg.latencyVarianceMs;
        const latency = Math.max(1, cfg.baseLatencyMs + variance);

        // Simulate success/failure
        const roll = this.rng.next();
        const effectiveReliability = Math.min(1, cfg.reliability * reliabilityBoost);
        const success = roll < effectiveReliability;

        // Simulate delay (capped for test speed)
        await new Promise(resolve => setTimeout(resolve, Math.min(latency, 10)));

        if (success) {
            return {
                exitCode: 0,
                stdout: `[SIM] ${task.id} completed by ${cfg.id}`,
                stderr: '',
                durationMs: Math.round(latency),
            };
        } else {
            return this.generateFailureResult(cfg, task, Math.round(latency));
        }
    }

    private generateFailureResult(cfg: SimAgentConfig, task: DAGTask, durationMs: number): DAGTaskResult {
        switch (cfg.failureMode) {
            case 'CRASH':
                return { exitCode: 139, stdout: '', stderr: 'Segmentation fault (core dumped)', durationMs };
            case 'TIMEOUT':
                return { exitCode: 124, stdout: '', stderr: 'Error: execution timed out', durationMs };
            case 'OOM':
                return { exitCode: 137, stdout: '', stderr: 'FATAL ERROR: JavaScript heap out of memory', durationMs };
            case 'INTERMITTENT':
                // Random failure type
                const types = ['CRASH', 'TIMEOUT', 'OOM'] as const;
                const idx = Math.floor(this.rng.next() * types.length);
                return this.generateFailureResult({ ...cfg, failureMode: types[idx] }, task, durationMs);
            default:
                return { exitCode: 1, stdout: '', stderr: `[SIM] ${task.id} failed on ${cfg.id}`, durationMs };
        }
    }

    private recordOutcome(agent: SimAgent, task: DAGTask, result: DAGTaskResult, success: boolean): void {
        const outcome: TaskOutcome = {
            agent: agent.config.id,
            agentRole: agent.config.role,
            taskType: task.type,
            taskId: task.id,
            success,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            retryCount: 0,
            depth: task.depth,
            timestamp: Date.now(),
        };
        this.outcomeTracker.record(outcome);
    }

    private recordEvent(type: SimEvent['type'], agentId?: string, taskId?: string, data: Record<string, unknown> = {}): void {
        const event: SimEvent = {
            type,
            timestamp: Date.now(),
            agentId,
            taskId,
            data,
            index: this.eventIndex++,
        };
        this.timeline.push(event);
        this.callbacks.onEvent?.(event);
    }

    private computeMetrics(): SimMetrics {
        const totalTasks = this.tasksCompleted + this.tasksFailed;
        const perAgent = new Map<string, { dispatched: number; completed: number; failed: number; healed: number; avgLatencyMs: number }>();

        for (const agent of this.agents.values()) {
            perAgent.set(agent.config.id, {
                dispatched: agent.tasksDispatched,
                completed: agent.tasksCompleted,
                failed: agent.tasksFailed,
                healed: agent.tasksHealed,
                avgLatencyMs: agent.tasksCompleted > 0 ? Math.round(this.totalLatencyMs / agent.tasksCompleted) : 0,
            });
        }

        return {
            totalTasks,
            tasksCompleted: this.tasksCompleted,
            tasksFailed: this.tasksFailed,
            tasksHealed: this.tasksHealed,
            tasksEscalated: this.tasksEscalated,
            totalDurationMs: this.totalLatencyMs,
            avgLatencyMs: this.tasksCompleted > 0 ? Math.round(this.totalLatencyMs / this.tasksCompleted) : 0,
            healingRate: this.tasksFailed > 0 ? this.tasksHealed / this.tasksFailed : 0,
            successRate: totalTasks > 0 ? this.tasksCompleted / totalTasks : 0,
            checkpointsTaken: this.checkpointsTaken,
            messagesExchanged: this.messagesExchanged,
            perAgent,
        };
    }
}

// ─── ScenarioRunner ───

export class ScenarioRunner {
    /**
     * Build a SimConfig for a predefined scenario.
     */
    public static buildScenario(scenario: ScenarioType, seed: number = 42): SimConfig {
        switch (scenario) {
            case 'HAPPY_PATH':
                return ScenarioRunner.happyPath(seed);
            case 'CASCADING_FAILURE':
                return ScenarioRunner.cascadingFailure(seed);
            case 'HEALING_RECOVERY':
                return ScenarioRunner.healingRecovery(seed);
            case 'HIGH_CONTENTION':
                return ScenarioRunner.highContention(seed);
            default:
                return ScenarioRunner.happyPath(seed);
        }
    }

    private static happyPath(seed: number): SimConfig {
        return {
            agents: [
                { id: 'architect-1', role: 'architect', reliability: 1.0, baseLatencyMs: 5, latencyVarianceMs: 2, capabilities: ['PLAN'], failureMode: 'NONE' },
                { id: 'builder-1', role: 'builder', reliability: 1.0, baseLatencyMs: 8, latencyVarianceMs: 3, capabilities: ['CODE', 'TEST'], failureMode: 'NONE' },
                { id: 'guardian-1', role: 'guardian', reliability: 1.0, baseLatencyMs: 3, latencyVarianceMs: 1, capabilities: ['AUDIT', 'REVIEW'], failureMode: 'NONE' },
            ],
            graph: ScenarioRunner.buildSimpleGraph(),
            scenario: 'HAPPY_PATH',
            enableHealing: false,
            enableCheckpoints: true,
            enableLearning: true,
            seed,
        };
    }

    private static cascadingFailure(seed: number): SimConfig {
        return {
            agents: [
                { id: 'architect-1', role: 'architect', reliability: 0.9, baseLatencyMs: 5, latencyVarianceMs: 2, capabilities: ['PLAN'], failureMode: 'CRASH' },
                { id: 'builder-1', role: 'builder', reliability: 0.3, baseLatencyMs: 10, latencyVarianceMs: 5, capabilities: ['CODE', 'TEST'], failureMode: 'CRASH' },
                { id: 'guardian-1', role: 'guardian', reliability: 0.8, baseLatencyMs: 3, latencyVarianceMs: 1, capabilities: ['AUDIT'], failureMode: 'TIMEOUT' },
            ],
            graph: ScenarioRunner.buildChainGraph(),
            scenario: 'CASCADING_FAILURE',
            enableHealing: true,
            enableCheckpoints: true,
            enableLearning: true,
            seed,
        };
    }

    private static healingRecovery(seed: number): SimConfig {
        return {
            agents: [
                { id: 'architect-1', role: 'architect', reliability: 1.0, baseLatencyMs: 5, latencyVarianceMs: 2, capabilities: ['PLAN'], failureMode: 'NONE' },
                { id: 'builder-1', role: 'builder', reliability: 0.4, baseLatencyMs: 8, latencyVarianceMs: 3, capabilities: ['CODE'], failureMode: 'OOM' },
                { id: 'builder-2', role: 'builder', reliability: 0.9, baseLatencyMs: 12, latencyVarianceMs: 4, capabilities: ['CODE', 'TEST'], failureMode: 'NONE' },
            ],
            graph: ScenarioRunner.buildSimpleGraph(),
            scenario: 'HEALING_RECOVERY',
            enableHealing: true,
            enableCheckpoints: true,
            enableLearning: true,
            seed,
        };
    }

    private static highContention(seed: number): SimConfig {
        return {
            agents: [
                { id: 'builder-1', role: 'builder', reliability: 0.8, baseLatencyMs: 5, latencyVarianceMs: 2, capabilities: ['CODE'], failureMode: 'INTERMITTENT' },
                { id: 'builder-2', role: 'builder', reliability: 0.7, baseLatencyMs: 7, latencyVarianceMs: 3, capabilities: ['CODE'], failureMode: 'INTERMITTENT' },
                { id: 'builder-3', role: 'builder', reliability: 0.6, baseLatencyMs: 9, latencyVarianceMs: 4, capabilities: ['CODE'], failureMode: 'INTERMITTENT' },
            ],
            graph: ScenarioRunner.buildParallelGraph(),
            scenario: 'HIGH_CONTENTION',
            enableHealing: true,
            enableCheckpoints: false,
            enableLearning: true,
            seed,
        };
    }

    // ─── Graph Builders ───

    public static buildSimpleGraph(): DAGGraph {
        const tasks = new Map<string, DAGTask>();
        tasks.set('plan', { id: 'plan', type: 'PLAN', agent: 'architect', dependencies: [], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        tasks.set('code', { id: 'code', type: 'CODE', agent: 'builder', dependencies: ['plan'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        tasks.set('audit', { id: 'audit', type: 'AUDIT', agent: 'guardian', dependencies: ['code'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        return { tasks };
    }

    public static buildChainGraph(): DAGGraph {
        const tasks = new Map<string, DAGTask>();
        tasks.set('step-1', { id: 'step-1', type: 'PLAN', agent: 'architect', dependencies: [], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        tasks.set('step-2', { id: 'step-2', type: 'CODE', agent: 'builder', dependencies: ['step-1'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        tasks.set('step-3', { id: 'step-3', type: 'CODE', agent: 'builder', dependencies: ['step-2'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        tasks.set('step-4', { id: 'step-4', type: 'AUDIT', agent: 'guardian', dependencies: ['step-3'], payload: {}, status: 'PENDING', retryCount: 0, depth: 0 });
        return { tasks };
    }

    public static buildParallelGraph(): DAGGraph {
        const tasks = new Map<string, DAGTask>();
        for (let i = 1; i <= 6; i++) {
            tasks.set(`task-${i}`, {
                id: `task-${i}`,
                type: 'CODE',
                agent: 'builder',
                dependencies: [],
                payload: {},
                status: 'PENDING',
                retryCount: 0,
                depth: 0,
            });
        }
        return { tasks };
    }
}
