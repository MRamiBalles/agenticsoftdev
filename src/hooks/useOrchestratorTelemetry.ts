import { useState, useEffect, useCallback } from 'react';
import type { DAGExecutionSummary, DAGTaskStatus } from '@/components/mission_control/DAGStatusPanel';
import type { AgentStats } from '@/components/mission_control/AgentPerformancePanel';
import type { HealingEvent } from '@/components/mission_control/HealingEventsPanel';
import type { CheckpointEntry } from '@/components/mission_control/CheckpointPanel';

/**
 * Simulated orchestrator telemetry hook.
 * 
 * In production this would connect via WebSocket to the running Orchestrator.
 * For now it generates realistic mock data based on the actual subsystem shapes
 * (Phases 4.0–4.8) so the dashboard can be developed and demonstrated.
 */

interface OrchestratorTelemetry {
    dagExecution: DAGExecutionSummary | null;
    agentStats: AgentStats[];
    healingEvents: HealingEvent[];
    healingSummary: { detected: number; healed: number; escalated: number };
    checkpoints: CheckpointEntry[];
    checkpointPolicy: { autoInterval: number; maxCheckpoints: number };
    isLive: boolean;
    refresh: () => void;
}

// ─── Deterministic seed-based random ───

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function pick<T>(arr: T[], rand: () => number): T {
    return arr[Math.floor(rand() * arr.length)];
}

// ─── Mock data generators ───

function generateDAGExecution(rand: () => number): DAGExecutionSummary {
    const taskDefs: { id: string; agent: string; type: string; deps: string[] }[] = [
        { id: 'plan-arch', agent: 'architect', type: 'PLAN', deps: [] },
        { id: 'research-api', agent: 'researcher', type: 'RESEARCH', deps: ['plan-arch'] },
        { id: 'design-ui', agent: 'designer', type: 'DESIGN', deps: ['plan-arch'] },
        { id: 'code-backend', agent: 'builder', type: 'CODE', deps: ['research-api'] },
        { id: 'code-frontend', agent: 'builder', type: 'CODE', deps: ['design-ui'] },
        { id: 'test-unit', agent: 'guardian', type: 'TEST', deps: ['code-backend', 'code-frontend'] },
        { id: 'audit-security', agent: 'guardian', type: 'AUDIT', deps: ['code-backend'] },
        { id: 'deploy-staging', agent: 'devops', type: 'DEPLOY', deps: ['test-unit', 'audit-security'] },
    ];

    const statuses: DAGTaskStatus['status'][] = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'FAILED', 'RUNNING', 'PENDING', 'SKIPPED'];

    const tasks: DAGTaskStatus[] = taskDefs.map((def, i) => {
        const status = i < taskDefs.length ? (rand() > 0.15 ? 'COMPLETED' : (rand() > 0.5 ? 'FAILED' : 'RUNNING')) : 'PENDING';
        return {
            id: def.id,
            agent: def.agent,
            type: def.type,
            status,
            durationMs: status === 'PENDING' ? 0 : Math.round(rand() * 2000 + 50),
            retries: status === 'FAILED' ? Math.round(rand() * 2) + 1 : (rand() > 0.8 ? 1 : 0),
        };
    });

    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const failed = tasks.filter(t => t.status === 'FAILED').length;
    const running = tasks.filter(t => t.status === 'RUNNING').length;
    const skipped = tasks.filter(t => t.status === 'SKIPPED').length;

    return {
        totalTasks: tasks.length,
        completed,
        failed,
        skipped,
        running,
        retries: tasks.reduce((sum, t) => sum + t.retries, 0),
        spawned: rand() > 0.7 ? Math.round(rand() * 2) + 1 : 0,
        durationMs: Math.round(rand() * 5000 + 1000),
        circuitBroken: rand() > 0.92,
        tasks,
    };
}

function generateAgentStats(rand: () => number): AgentStats[] {
    const agents = [
        { agent: 'architect', role: 'architect' },
        { agent: 'builder', role: 'builder' },
        { agent: 'guardian', role: 'guardian' },
        { agent: 'researcher', role: 'researcher' },
        { agent: 'devops', role: 'devops' },
        { agent: 'designer', role: 'designer' },
    ];

    return agents.map(a => {
        const totalTasks = Math.round(rand() * 20) + 3;
        const successRate = 0.6 + rand() * 0.4;
        const failureCount = Math.round(totalTasks * (1 - successRate));
        return {
            agent: a.agent,
            role: a.role,
            totalTasks,
            successRate,
            avgDurationMs: rand() * 1500 + 100,
            failureCount,
            retryCount: Math.round(failureCount * rand() * 2),
            recommendations: successRate < 0.8
                ? [`Consider reducing task complexity for ${a.agent}`]
                : [],
        };
    });
}

function generateHealingEvents(rand: () => number): { events: HealingEvent[]; detected: number; healed: number; escalated: number } {
    const categories = ['OOM', 'NETWORK_ERROR', 'TIMEOUT', 'DEPENDENCY_FAILURE', 'UNKNOWN'];
    const actions = ['SCALE_DOWN', 'RETRY_WITH_BACKOFF', 'ISOLATE_AND_RETRY', 'RESTART_SANDBOX', 'ESCALATE'];
    const agents = ['builder', 'devops', 'researcher', 'guardian'];

    const count = Math.round(rand() * 6) + 2;
    const events: HealingEvent[] = [];
    let healed = 0;
    let escalated = 0;

    for (let i = 0; i < count; i++) {
        const category = pick(categories, rand);
        const wasHealed = rand() > 0.25;
        const wasEscalated = !wasHealed && rand() > 0.5;
        const action = wasEscalated ? 'ESCALATE' : pick(actions.filter(a => a !== 'ESCALATE'), rand);

        if (wasHealed) healed++;
        if (wasEscalated) escalated++;

        events.push({
            id: `heal-${i}`,
            taskId: `task-${Math.round(rand() * 100)}`,
            agent: pick(agents, rand),
            failureCategory: category,
            actionTaken: action,
            healed: wasHealed,
            attempts: Math.round(rand() * 3) + 1,
            timestamp: Date.now() - Math.round(rand() * 3600000),
            escalated: wasEscalated,
            escalationLevel: wasEscalated ? 'HUMAN' : undefined,
        });
    }

    events.sort((a, b) => b.timestamp - a.timestamp);

    return { events, detected: count, healed, escalated };
}

function generateCheckpoints(rand: () => number): CheckpointEntry[] {
    const count = Math.round(rand() * 4) + 2;
    const entries: CheckpointEntry[] = [];

    for (let i = 0; i < count; i++) {
        const tasksCompleted = Math.round(rand() * 6) + 2;
        entries.push({
            id: `ckpt_${Date.now() - (count - i) * 60000}_${Math.round(rand() * 9999)}`,
            label: i === count - 1 ? 'final-checkpoint' : (rand() > 0.6 ? `auto-${i + 1}` : undefined),
            createdAt: Date.now() - (count - i) * 60000,
            sizeBytes: Math.round(rand() * 8000) + 500,
            tasksCompleted,
            totalRetries: Math.round(rand() * 3),
            integrityValid: rand() > 0.08,
            hash: Array.from({ length: 64 }, () => Math.floor(rand() * 16).toString(16)).join(''),
        });
    }

    return entries;
}

// ─── Hook ───

export function useOrchestratorTelemetry(seed: number = 42): OrchestratorTelemetry {
    const [data, setData] = useState<Omit<OrchestratorTelemetry, 'refresh' | 'isLive'>>({
        dagExecution: null,
        agentStats: [],
        healingEvents: [],
        healingSummary: { detected: 0, healed: 0, escalated: 0 },
        checkpoints: [],
        checkpointPolicy: { autoInterval: 5, maxCheckpoints: 10 },
    });

    const generate = useCallback((s: number) => {
        const rand = seededRandom(s);
        const dag = generateDAGExecution(rand);
        const agents = generateAgentStats(rand);
        const healing = generateHealingEvents(rand);
        const checkpoints = generateCheckpoints(rand);

        setData({
            dagExecution: dag,
            agentStats: agents,
            healingEvents: healing.events,
            healingSummary: { detected: healing.detected, healed: healing.healed, escalated: healing.escalated },
            checkpoints,
            checkpointPolicy: { autoInterval: 5, maxCheckpoints: 10 },
        });
    }, []);

    useEffect(() => {
        generate(seed);
    }, [seed, generate]);

    const refresh = useCallback(() => {
        generate(Date.now());
    }, [generate]);

    return {
        ...data,
        isLive: false,
        refresh,
    };
}
