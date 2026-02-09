/**
 * Telemetry Emitter — Orchestrator → Frontend Bridge
 * 
 * Collects structured telemetry events from all orchestrator subsystems
 * and exposes them for consumption by the frontend (via polling, SSE, or WebSocket).
 * 
 * Phase 7: Frontend ↔ Orchestrator Bridge
 * 
 * Architecture:
 *   Orchestrator subsystem callbacks → TelemetryEmitter.emit()
 *   → Internal ring buffer (bounded, no memory leak)
 *   → Consumer reads via snapshot() or subscribe()
 */

// ─── Shared Protocol Types ───

export type TelemetryEventType =
    | 'DAG_START'
    | 'DAG_COMPLETE'
    | 'TASK_DISPATCH'
    | 'TASK_COMPLETE'
    | 'TASK_FAIL'
    | 'TASK_RETRY'
    | 'HEALING_ATTEMPT'
    | 'HEALING_SUCCESS'
    | 'HEALING_ESCALATION'
    | 'CHECKPOINT_SAVED'
    | 'ATDI_ANALYSIS'
    | 'ATDI_BLOCKED'
    | 'SPEC_DRIFT'
    | 'SPEC_ALIGNED'
    | 'AGENT_OUTCOME'
    | 'NEGOTIATION_RESOLVED'
    | 'AUCTION_CLOSED'
    | 'SYSTEM_BOOT'
    | 'SYSTEM_SHUTDOWN';

export interface TelemetryEvent {
    id: string;
    type: TelemetryEventType;
    timestamp: number;
    source: string;
    payload: Record<string, unknown>;
}

export interface TelemetrySnapshot {
    /** Monotonically increasing sequence number */
    seq: number;
    /** Timestamp of snapshot generation */
    timestamp: number;
    /** Events since last snapshot (or all if first) */
    events: TelemetryEvent[];
    /** Aggregated counters */
    counters: TelemetryCounters;
}

export interface TelemetryCounters {
    totalEvents: number;
    tasksDispatched: number;
    tasksCompleted: number;
    tasksFailed: number;
    tasksRetried: number;
    healingAttempts: number;
    healingSuccesses: number;
    escalations: number;
    checkpointsSaved: number;
    atdiScore: number;
    atdiTrafficLight: string;
    driftAlerts: number;
    upSinceMs: number;
}

export interface TelemetrySubscriber {
    (event: TelemetryEvent): void;
}

// ─── TelemetryEmitter ───

export class TelemetryEmitter {
    private events: TelemetryEvent[] = [];
    private maxBufferSize: number;
    private seq: number = 0;
    private lastSnapshotSeq: number = 0;
    private counters: TelemetryCounters;
    private subscribers: Set<TelemetrySubscriber> = new Set();
    private eventIdCounter: number = 0;
    private bootTime: number;

    constructor(maxBufferSize: number = 1000) {
        this.maxBufferSize = maxBufferSize;
        this.bootTime = Date.now();
        this.counters = {
            totalEvents: 0,
            tasksDispatched: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            tasksRetried: 0,
            healingAttempts: 0,
            healingSuccesses: 0,
            escalations: 0,
            checkpointsSaved: 0,
            atdiScore: 0,
            atdiTrafficLight: 'GREEN',
            driftAlerts: 0,
            upSinceMs: 0,
        };
    }

    /**
     * Emit a telemetry event. Updates counters and notifies subscribers.
     */
    public emit(type: TelemetryEventType, source: string, payload: Record<string, unknown> = {}): TelemetryEvent {
        const event: TelemetryEvent = {
            id: `tel_${++this.eventIdCounter}`,
            type,
            timestamp: Date.now(),
            source,
            payload,
        };

        // Ring buffer
        this.events.push(event);
        if (this.events.length > this.maxBufferSize) {
            this.events.shift();
        }

        this.seq++;
        this.updateCounters(event);

        // Notify subscribers
        for (const sub of this.subscribers) {
            try { sub(event); } catch { /* subscriber errors don't crash emitter */ }
        }

        return event;
    }

    /**
     * Get a snapshot of events since the last snapshot call.
     * Useful for polling-based consumers.
     */
    public snapshot(): TelemetrySnapshot {
        const since = this.lastSnapshotSeq;
        this.lastSnapshotSeq = this.seq;

        // Find events added since last snapshot
        const newEvents = this.events.filter((_, i) => {
            const globalIdx = this.seq - this.events.length + i;
            return globalIdx >= since;
        });

        return {
            seq: this.seq,
            timestamp: Date.now(),
            events: newEvents,
            counters: { ...this.counters, upSinceMs: Date.now() - this.bootTime },
        };
    }

    /**
     * Get full snapshot (all buffered events + counters).
     */
    public fullSnapshot(): TelemetrySnapshot {
        return {
            seq: this.seq,
            timestamp: Date.now(),
            events: [...this.events],
            counters: { ...this.counters, upSinceMs: Date.now() - this.bootTime },
        };
    }

    /**
     * Subscribe to real-time events. Returns unsubscribe function.
     */
    public subscribe(fn: TelemetrySubscriber): () => void {
        this.subscribers.add(fn);
        return () => { this.subscribers.delete(fn); };
    }

    /**
     * Get current counters.
     */
    public getCounters(): TelemetryCounters {
        return { ...this.counters, upSinceMs: Date.now() - this.bootTime };
    }

    /**
     * Get total event count.
     */
    public getEventCount(): number {
        return this.counters.totalEvents;
    }

    /**
     * Reset all state (for testing).
     */
    public reset(): void {
        this.events = [];
        this.seq = 0;
        this.lastSnapshotSeq = 0;
        this.eventIdCounter = 0;
        this.bootTime = Date.now();
        this.counters = {
            totalEvents: 0,
            tasksDispatched: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            tasksRetried: 0,
            healingAttempts: 0,
            healingSuccesses: 0,
            escalations: 0,
            checkpointsSaved: 0,
            atdiScore: 0,
            atdiTrafficLight: 'GREEN',
            driftAlerts: 0,
            upSinceMs: 0,
        };
    }

    // ─── Internal ───

    private updateCounters(event: TelemetryEvent): void {
        this.counters.totalEvents++;

        switch (event.type) {
            case 'TASK_DISPATCH':
                this.counters.tasksDispatched++;
                break;
            case 'TASK_COMPLETE':
                this.counters.tasksCompleted++;
                break;
            case 'TASK_FAIL':
                this.counters.tasksFailed++;
                break;
            case 'TASK_RETRY':
                this.counters.tasksRetried++;
                break;
            case 'HEALING_ATTEMPT':
                this.counters.healingAttempts++;
                break;
            case 'HEALING_SUCCESS':
                this.counters.healingSuccesses++;
                break;
            case 'HEALING_ESCALATION':
                this.counters.escalations++;
                break;
            case 'CHECKPOINT_SAVED':
                this.counters.checkpointsSaved++;
                break;
            case 'ATDI_ANALYSIS':
                if (typeof event.payload.score === 'number') {
                    this.counters.atdiScore = event.payload.score;
                }
                if (typeof event.payload.trafficLight === 'string') {
                    this.counters.atdiTrafficLight = event.payload.trafficLight;
                }
                break;
            case 'SPEC_DRIFT':
                this.counters.driftAlerts++;
                break;
        }
    }
}
