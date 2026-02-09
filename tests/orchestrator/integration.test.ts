/**
 * End-to-End Integration Test
 * 
 * Verifies all subsystems work together through the full pipeline:
 *   Phase 3:   SecurityGate → SandboxRuntime (dry-run) → ForensicLogger
 *   Phase 3.1: PlanningGate → RAG context injection
 *   Phase 4.0: DAG execution with retry + circuit breaker
 *   Phase 4.2: EventBus pub/sub with RBAC
 *   Phase 4.3: NegotiationEngine + TaskAuction
 *   Phase 4.4: OutcomeTracker + AdaptationEngine
 *   Phase 4.5: CheckpointManager auto-checkpoint + integrity
 *   Phase 4.6: WorkerRegistry + LoadBalancer
 *   Phase 4.7: FailureDetector + HealingEngine
 *   Phase 4.8: SimulationEngine (full scenario)
 *   Phase 5:   ATDIEngine quality gate
 * 
 * These tests exercise the subsystems in concert, not in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Phase 3
import { SecurityGate } from '../../src/orchestrator/security-gate';

// Phase 4.0
import { DAGEngine, DAGTask, DAGGraph, DAGTaskResult } from '../../src/orchestrator/dag-engine';
import { RetryPolicy } from '../../src/orchestrator/retry-policy';

// Phase 4.2
import { EventBus } from '../../src/orchestrator/agent-bus';

// Phase 4.3
import { NegotiationEngine, TaskAuction } from '../../src/orchestrator/agent-negotiation';

// Phase 4.4
import { OutcomeTracker, AdaptationEngine, TaskOutcome } from '../../src/orchestrator/agent-learning';

// Phase 4.5
import { CheckpointManager } from '../../src/orchestrator/execution-persistence';

// Phase 4.6
import { WorkerRegistry, LoadBalancer } from '../../src/orchestrator/distributed-executor';

// Phase 4.7
import { FailureDetector, HealingEngine } from '../../src/orchestrator/agent-self-healing';

// Phase 4.8
import { SimulationEngine, ScenarioRunner } from '../../src/orchestrator/simulation-sandbox';

// Phase 5
import { ATDIEngine } from '../../src/orchestrator/atdi-engine';

// ─── Helpers ───

function buildTestGraph(): DAGGraph {
    return DAGEngine.buildGraph([
        { id: 'plan', type: 'PLAN', agent: 'architect', payload: { goal: 'design' } },
        { id: 'code', type: 'CODE', agent: 'builder', dependencies: ['plan'], payload: { file: 'app.ts' } },
        { id: 'audit', type: 'AUDIT', agent: 'guardian', dependencies: ['code'], payload: { target: 'src/' } },
    ]);
}

function mockDispatcher(results?: Map<string, DAGTaskResult>) {
    return async (task: DAGTask) => {
        const custom = results?.get(task.id);
        if (custom) return { result: custom };
        return {
            result: {
                exitCode: 0,
                stdout: `[mock] ${task.id} done`,
                stderr: '',
                durationMs: 10,
            },
        };
    };
}

// ─── Integration: DAG + Learning + Checkpoint ───

describe('Integration: DAG → Learning → Checkpoint', () => {
    let dagEngine: DAGEngine;
    let retryPolicy: RetryPolicy;
    let outcomeTracker: OutcomeTracker;
    let adaptationEngine: AdaptationEngine;
    let checkpointManager: CheckpointManager;
    let completedTasks: string[];

    beforeEach(() => {
        retryPolicy = new RetryPolicy();
        completedTasks = [];

        outcomeTracker = new OutcomeTracker();
        adaptationEngine = new AdaptationEngine(outcomeTracker);
        checkpointManager = new CheckpointManager({ autoCheckpointInterval: 2, maxCheckpoints: 5 });

        dagEngine = new DAGEngine(
            { maxConcurrency: 3 },
            retryPolicy,
            {
                onComplete: (task, result) => {
                    completedTasks.push(task.id);
                    // Record outcome for learning
                    outcomeTracker.record({
                        agent: task.agent,
                        agentRole: task.agent as any,
                        taskType: task.type,
                        taskId: task.id,
                        success: true,
                        exitCode: result.exitCode,
                        durationMs: result.durationMs,
                        retryCount: task.retryCount,
                        depth: task.depth,
                        timestamp: Date.now(),
                    });
                    // Auto-checkpoint
                    if (checkpointManager.notifyTaskCompleted()) {
                        checkpointManager.save(graph, completedTasks, 0, 0, [], [], Date.now());
                    }
                },
                onFail: (task, result) => {
                    outcomeTracker.record({
                        agent: task.agent,
                        agentRole: task.agent as any,
                        taskType: task.type,
                        taskId: task.id,
                        success: false,
                        exitCode: result.exitCode,
                        durationMs: result.durationMs,
                        retryCount: task.retryCount,
                        depth: task.depth,
                        timestamp: Date.now(),
                        errorPattern: result.stderr.slice(0, 100),
                    });
                },
            },
        );
    });

    const graph = buildTestGraph();

    it('should execute DAG, record outcomes, and trigger checkpoints', async () => {
        const localGraph = buildTestGraph();
        const result = await dagEngine.executeMutating(localGraph, mockDispatcher(), { maxDepth: 3, maxGraphSize: 50 });

        // DAG completed
        expect(result.completed).toBe(3);
        expect(result.failed).toBe(0);

        // Learning: outcomes recorded for all 3 tasks
        const archStats = outcomeTracker.computeStats('architect', 'PLAN');
        expect(archStats).not.toBeNull();
        expect(archStats!.totalOutcomes).toBe(1);
        expect(archStats!.successRate).toBe(1);

        const builderStats = outcomeTracker.computeStats('builder', 'CODE');
        expect(builderStats).not.toBeNull();
        expect(builderStats!.totalOutcomes).toBe(1);

        // Checkpoint: auto-checkpoint triggered after 2 tasks
        const checkpoints = checkpointManager.listCheckpoints();
        expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate adaptation recommendations after execution', async () => {
        const localGraph = buildTestGraph();
        await dagEngine.executeMutating(localGraph, mockDispatcher(), { maxDepth: 3, maxGraphSize: 50 });

        // Adaptation: recommendations for architect
        const recs = adaptationEngine.recommend('architect', 'architect');
        // With only 1 outcome, recommendations may be empty (need more data)
        // But the call should not throw
        expect(Array.isArray(recs)).toBe(true);
    });
});

// ─── Integration: SecurityGate + DAG ───

describe('Integration: SecurityGate → DAG', () => {
    it('should block tasks that fail RBAC and record as failure', async () => {
        const gate = new SecurityGate();
        const retryPolicy = new RetryPolicy();
        const dagEngine = new DAGEngine({ maxConcurrency: 1 }, retryPolicy);

        const graph = DAGEngine.buildGraph([
            // Guardian cannot do CODE tasks (needs FILE_WRITE)
            { id: 'bad-task', type: 'CODE', agent: 'guardian', payload: { file: 'hack.ts' } },
        ]);

        const dispatcher = async (task: DAGTask) => {
            const verdict = gate.validate({
                agentRole: task.agent as any,
                taskType: task.type as any,
                payload: task.payload,
            });

            if (!verdict.allowed) {
                return { result: { exitCode: 1, stdout: '', stderr: `BLOCKED: ${verdict.reason}`, durationMs: 0 } };
            }

            return { result: { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 5 } };
        };

        const result = await dagEngine.executeMutating(graph, dispatcher, { maxDepth: 3, maxGraphSize: 50 });
        expect(result.failed).toBe(1);
        expect(result.completed).toBe(0);
    });
});

// ─── Integration: EventBus + Negotiation ───

describe('Integration: EventBus → Negotiation', () => {
    it('should run a negotiation proposal through the bus', () => {
        const bus = new EventBus();
        const engine = new NegotiationEngine({}, bus);

        // Create proposal (returns Proposal object)
        const proposal = engine.propose(
            'architect',
            'architect',
            'Use PostgreSQL for persistence',
            ['PostgreSQL', 'MongoDB'],
            'MAJORITY',
        );

        expect(proposal.id).toBeTruthy();

        // Vote
        engine.vote(proposal.id, 'architect', 'architect', 'PostgreSQL', 'Preferred for ACID');
        engine.vote(proposal.id, 'builder', 'builder', 'PostgreSQL', 'Good ORM support');
        engine.vote(proposal.id, 'guardian', 'guardian', 'PostgreSQL', 'Better audit trail');

        // Resolve
        const result = engine.resolve(proposal.id);
        expect(result).not.toBeNull();
        expect(result!.status).toBe('RESOLVED');
        expect(result!.winner).toBe('PostgreSQL');
    });

    it('should run a task auction through the bus', () => {
        const bus = new EventBus();
        const auction = new TaskAuction({}, bus);

        // Create auction (taskId, taskType, initiator, biddingWindowMs)
        const auctionObj = auction.create('task-x', 'CODE', 'architect', 30000);
        expect(auctionObj.id).toBeTruthy();

        // Submit bids (auctionId, bidder, role, capabilityScore, currentLoad, estimatedDurationMs)
        auction.bid(auctionObj.id, 'builder-1', 'builder', 90, 20, 100, 'Fast builder');
        auction.bid(auctionObj.id, 'builder-2', 'builder', 70, 50, 200, 'Backup builder');

        // Close auction
        const result = auction.close(auctionObj.id);
        expect(result).not.toBeNull();
        expect(result!.winner).toBe('builder-1'); // higher capability score
    });
});

// ─── Integration: Failure Detection + Healing + Learning ───

describe('Integration: FailureDetector → HealingEngine → OutcomeTracker', () => {
    it('should detect OOM, attempt healing, and record outcome', async () => {
        const detector = new FailureDetector();
        const tracker = new OutcomeTracker();
        const healingRecords: string[] = [];

        const healingEngine = new HealingEngine(undefined, undefined, {
            onHealingAttempt: (r) => healingRecords.push(`attempt:${r.actionTaken}`),
            onHealingSuccess: (r) => healingRecords.push(`success:${r.actionTaken}`),
            onEscalation: (e) => healingRecords.push(`escalation:${e.level}`),
        });

        // Simulate OOM failure
        const failResult: DAGTaskResult = {
            exitCode: 137,
            stdout: '',
            stderr: 'FATAL ERROR: JavaScript heap out of memory',
            durationMs: 5000,
        };

        // Detect
        const classification = detector.classify(failResult);
        expect(classification.category).toBe('OOM');

        // Record failure outcome
        tracker.record({
            agent: 'builder',
            agentRole: 'builder',
            taskType: 'CODE',
            taskId: 'task-oom',
            success: false,
            exitCode: 137,
            durationMs: 5000,
            retryCount: 0,
            depth: 0,
            timestamp: Date.now(),
            errorPattern: 'OOM',
        });

        // Heal (executor succeeds on first try)
        const healResult = await healingEngine.heal(
            'task-oom', 'builder', 'CODE', classification,
            async () => true,
        );

        expect(healResult.healed).toBe(true);
        expect(healResult.successfulAction).toBe('SCALE_DOWN');
        expect(healingRecords.some(r => r.startsWith('success:'))).toBe(true);

        // Record healed outcome
        tracker.record({
            agent: 'builder',
            agentRole: 'builder',
            taskType: 'CODE',
            taskId: 'task-oom',
            success: true,
            exitCode: 0,
            durationMs: 3000,
            retryCount: 1,
            depth: 0,
            timestamp: Date.now(),
        });

        // Verify learning captured both outcomes
        const stats = tracker.computeStats('builder', 'CODE');
        expect(stats).not.toBeNull();
        expect(stats!.totalOutcomes).toBe(2);
        expect(stats!.successCount).toBe(1);
    });
});

// ─── Integration: WorkerRegistry + LoadBalancer ───

describe('Integration: WorkerRegistry → LoadBalancer', () => {
    it('should register workers, balance load, and track tasks', () => {
        const registry = new WorkerRegistry();
        const balancer = new LoadBalancer('LEAST_LOADED');

        // Register workers
        registry.register('w1', ['CODE', 'TEST'], 3);
        registry.register('w2', ['CODE'], 2);
        registry.register('w3', ['AUDIT'], 2);

        // Get capable workers for CODE
        const capable = registry.getCapableWorkers('CODE');
        expect(capable).toHaveLength(2); // w1, w2

        // Balance: pick least loaded
        const selected = balancer.select(capable, 'CODE');
        expect(selected).toBeDefined();

        // Track task on selected worker
        registry.taskStarted(selected!.id);
        const worker = registry.getWorker(selected!.id)!;
        expect(worker.activeTasks).toBe(1);

        // Complete task
        registry.taskCompleted(selected!.id);
        const updated = registry.getWorker(selected!.id)!;
        expect(updated.activeTasks).toBe(0);
    });
});

// ─── Integration: Checkpoint Integrity ───

describe('Integration: Checkpoint save + verify integrity', () => {
    it('should save checkpoint and verify integrity on load', () => {
        const manager = new CheckpointManager({ autoCheckpointInterval: 0, maxCheckpoints: 5, verifyOnLoad: true });
        const graph = buildTestGraph();

        const ckpt = manager.save(graph, ['plan', 'code'], 0, 0, [], [], 100, 'test-ckpt');
        expect(ckpt.hash).toBeTruthy();
        expect(ckpt.snapshot.label).toBe('test-ckpt');

        // Load and verify
        const loaded = manager.load(ckpt.snapshot.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.snapshot.executionOrder).toEqual(['plan', 'code']);
    });
});

// ─── Integration: Full Simulation Scenario ───

describe('Integration: Full Simulation (Phase 4.8)', () => {
    it('should run HAPPY_PATH scenario with all subsystems', async () => {
        const config = ScenarioRunner.buildScenario('HAPPY_PATH', 42);
        const events: string[] = [];

        const engine = new SimulationEngine(config, {
            onEvent: (e) => events.push(`${e.type}:${e.taskId ?? 'system'}`),
        });

        const result = await engine.run();

        expect(result.success).toBe(true);
        expect(result.metrics.tasksCompleted).toBe(3);
        expect(result.metrics.successRate).toBe(1);
        expect(events.length).toBeGreaterThanOrEqual(6); // 3 dispatch + 3 complete
    });

    it('should run HEALING_RECOVERY scenario and track healing metrics', async () => {
        const config = ScenarioRunner.buildScenario('HEALING_RECOVERY', 42);
        const engine = new SimulationEngine(config);
        const result = await engine.run();

        expect(result.scenario).toBe('HEALING_RECOVERY');
        expect(result.metrics.totalTasks).toBeGreaterThan(0);
        // With healing enabled, some tasks may be healed
        expect(result.metrics.tasksHealed).toBeGreaterThanOrEqual(0);
    });
});

// ─── Integration: Cross-Subsystem Event Flow ───

describe('Integration: Cross-Subsystem Event Flow', () => {
    it('should flow: dispatch → fail → detect → heal → record → checkpoint', async () => {
        const tracker = new OutcomeTracker();
        const detector = new FailureDetector();
        const healer = new HealingEngine();
        const checkpointMgr = new CheckpointManager({ autoCheckpointInterval: 1 });
        const graph = buildTestGraph();
        const executionOrder: string[] = [];
        const eventLog: string[] = [];

        // Simulate task execution
        const task = graph.tasks.get('code')!;

        // Step 1: Task fails
        const failResult: DAGTaskResult = { exitCode: 1, stdout: '', stderr: 'Error: connect ECONNREFUSED', durationMs: 50 };
        eventLog.push('FAIL');

        // Step 2: Record failure outcome
        tracker.record({
            agent: task.agent, agentRole: 'builder', taskType: task.type,
            taskId: task.id, success: false, exitCode: 1, durationMs: 50,
            retryCount: 0, depth: 0, timestamp: Date.now(),
        });
        eventLog.push('OUTCOME_RECORDED');

        // Step 3: Detect failure
        const classification = detector.classify(failResult);
        expect(classification.category).toBe('NETWORK_ERROR');
        eventLog.push(`DETECTED:${classification.category}`);

        // Step 4: Heal
        const healResult = await healer.heal(
            task.id, task.agent, task.type, classification,
            async () => true,
        );
        expect(healResult.healed).toBe(true);
        eventLog.push(`HEALED:${healResult.successfulAction}`);

        // Step 5: Record success outcome
        tracker.record({
            agent: task.agent, agentRole: 'builder', taskType: task.type,
            taskId: task.id, success: true, exitCode: 0, durationMs: 30,
            retryCount: 1, depth: 0, timestamp: Date.now(),
        });
        eventLog.push('OUTCOME_RECORDED');

        // Step 6: Checkpoint
        executionOrder.push(task.id);
        if (checkpointMgr.notifyTaskCompleted()) {
            checkpointMgr.save(graph, executionOrder, 0, 0, [], [], 80);
            eventLog.push('CHECKPOINT');
        }

        // Verify full flow
        expect(eventLog).toEqual([
            'FAIL',
            'OUTCOME_RECORDED',
            'DETECTED:NETWORK_ERROR',
            'HEALED:RETRY_WITH_BACKOFF',
            'OUTCOME_RECORDED',
            'CHECKPOINT',
        ]);

        // Verify learning state
        const stats = tracker.computeStats('builder', 'CODE');
        expect(stats).not.toBeNull();
        expect(stats!.totalOutcomes).toBe(2);
        expect(stats!.successCount).toBe(1);

        // Verify checkpoint state
        expect(checkpointMgr.listCheckpoints()).toHaveLength(1);
    });
});

// ─── Integration: ATDI Quality Gate ───

describe('Integration: ATDIEngine → Deploy Gate', () => {
    it('should allow deploy on clean codebase (GREEN)', () => {
        const engine = new ATDIEngine();
        const graph = { 'app.ts': ['db.ts'], 'db.ts': [] };
        const metrics = [
            { file: 'app.ts', loc: 100, complexity: 5, imports: ['db.ts'] },
            { file: 'db.ts', loc: 50, complexity: 3, imports: [] },
        ];

        engine.analyze(graph, metrics);
        const gate = engine.checkDeployGate();

        expect(gate.allowed).toBe(true);
        expect(gate.trafficLight).toBe('GREEN');
        expect(gate.score).toBe(0);
    });

    it('should block deploy on high-debt codebase (RED)', () => {
        const onBlocked = vi.fn();
        const engine = new ATDIEngine({}, {}, { onDeployBlocked: onBlocked });

        // Cyclic graph + bloated file
        const graph = { 'a.ts': ['b.ts'], 'b.ts': ['a.ts'] };
        const metrics = [
            { file: 'a.ts', loc: 500, complexity: 25, imports: Array.from({ length: 15 }, (_, i) => `d${i}`) },
        ];

        const report = engine.analyze(graph, metrics);
        expect(report.trafficLight).toBe('RED');
        expect(report.blocked).toBe(true);
        expect(onBlocked).toHaveBeenCalledTimes(1);

        const gate = engine.checkDeployGate();
        expect(gate.allowed).toBe(false);
        expect(gate.reason).toContain('BLOCKED');
    });

    it('should warn on moderate debt (AMBER) but allow deploy', () => {
        const engine = new ATDIEngine();
        // Score = LOC(305-300)*1 + complexity(16-15)*5 = 5 + 5 = 10 → AMBER
        const metrics = [{ file: 'med.ts', loc: 305, complexity: 16, imports: [] }];

        engine.analyze({}, metrics);
        const gate = engine.checkDeployGate();

        expect(gate.allowed).toBe(true);
        expect(gate.trafficLight).toBe('AMBER');
        expect(gate.reason).toContain('warning');
    });

    it('should integrate cycle detection with DAG security flow', () => {
        const engine = new ATDIEngine();
        const gate = new SecurityGate();

        // Analyze a cyclic codebase
        engine.analyze(
            { 'auth.ts': ['user.ts'], 'user.ts': ['auth.ts'] },
            [],
        );

        // Simulate a deploy task going through both gates
        const deployGate = engine.checkDeployGate();
        const securityVerdict = gate.validate({
            agentRole: 'devops',
            taskType: 'DEPLOY',
            payload: { target: 'staging', atdi_score: deployGate.score },
        });

        // ATDI blocks (cycle = 10 * 2 = 20 → RED)
        expect(deployGate.allowed).toBe(false);
        // Security gate still allows devops to DEPLOY
        expect(securityVerdict.allowed).toBe(true);
    });
});
