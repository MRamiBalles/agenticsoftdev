/**
 * Telemetry Emitter Tests
 * 
 * Covers: event emission, ring buffer, counters, snapshots, subscriptions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryEmitter } from '../../src/orchestrator/telemetry-emitter';

describe('TelemetryEmitter - Emission', () => {
    let emitter: TelemetryEmitter;

    beforeEach(() => {
        emitter = new TelemetryEmitter();
    });

    it('should emit events with unique IDs', () => {
        const e1 = emitter.emit('TASK_DISPATCH', 'builder', { taskId: 't1' });
        const e2 = emitter.emit('TASK_COMPLETE', 'builder', { taskId: 't1' });
        expect(e1.id).not.toBe(e2.id);
        expect(e1.type).toBe('TASK_DISPATCH');
        expect(e2.type).toBe('TASK_COMPLETE');
    });

    it('should include timestamp and source', () => {
        const e = emitter.emit('SYSTEM_BOOT', 'kernel');
        expect(e.timestamp).toBeGreaterThan(0);
        expect(e.source).toBe('kernel');
    });

    it('should accept payload', () => {
        const e = emitter.emit('ATDI_ANALYSIS', 'system', { score: 12, trafficLight: 'AMBER' });
        expect(e.payload.score).toBe(12);
        expect(e.payload.trafficLight).toBe('AMBER');
    });
});

describe('TelemetryEmitter - Ring Buffer', () => {
    it('should cap events at maxBufferSize', () => {
        const emitter = new TelemetryEmitter(5);
        for (let i = 0; i < 10; i++) {
            emitter.emit('TASK_DISPATCH', 'test', { i });
        }
        const snap = emitter.fullSnapshot();
        expect(snap.events).toHaveLength(5);
        // Should keep the latest 5
        expect(snap.events[0].payload.i).toBe(5);
        expect(snap.events[4].payload.i).toBe(9);
    });

    it('should default to 1000 buffer size', () => {
        const emitter = new TelemetryEmitter();
        for (let i = 0; i < 50; i++) {
            emitter.emit('TASK_DISPATCH', 'test');
        }
        expect(emitter.getEventCount()).toBe(50);
    });
});

describe('TelemetryEmitter - Counters', () => {
    let emitter: TelemetryEmitter;

    beforeEach(() => {
        emitter = new TelemetryEmitter();
    });

    it('should count task events', () => {
        emitter.emit('TASK_DISPATCH', 'a');
        emitter.emit('TASK_DISPATCH', 'a');
        emitter.emit('TASK_COMPLETE', 'a');
        emitter.emit('TASK_FAIL', 'a');
        emitter.emit('TASK_RETRY', 'a');

        const c = emitter.getCounters();
        expect(c.totalEvents).toBe(5);
        expect(c.tasksDispatched).toBe(2);
        expect(c.tasksCompleted).toBe(1);
        expect(c.tasksFailed).toBe(1);
        expect(c.tasksRetried).toBe(1);
    });

    it('should count healing events', () => {
        emitter.emit('HEALING_ATTEMPT', 'healer');
        emitter.emit('HEALING_ATTEMPT', 'healer');
        emitter.emit('HEALING_SUCCESS', 'healer');
        emitter.emit('HEALING_ESCALATION', 'healer');

        const c = emitter.getCounters();
        expect(c.healingAttempts).toBe(2);
        expect(c.healingSuccesses).toBe(1);
        expect(c.escalations).toBe(1);
    });

    it('should track ATDI score and traffic light', () => {
        emitter.emit('ATDI_ANALYSIS', 'system', { score: 8, trafficLight: 'AMBER' });
        const c = emitter.getCounters();
        expect(c.atdiScore).toBe(8);
        expect(c.atdiTrafficLight).toBe('AMBER');
    });

    it('should track checkpoint and drift counters', () => {
        emitter.emit('CHECKPOINT_SAVED', 'system');
        emitter.emit('CHECKPOINT_SAVED', 'system');
        emitter.emit('SPEC_DRIFT', 'system');

        const c = emitter.getCounters();
        expect(c.checkpointsSaved).toBe(2);
        expect(c.driftAlerts).toBe(1);
    });

    it('should track uptime', () => {
        const c = emitter.getCounters();
        expect(c.upSinceMs).toBeGreaterThanOrEqual(0);
    });
});

describe('TelemetryEmitter - Snapshots', () => {
    it('should return incremental events via snapshot()', () => {
        const emitter = new TelemetryEmitter();

        emitter.emit('TASK_DISPATCH', 'a');
        emitter.emit('TASK_COMPLETE', 'a');

        const snap1 = emitter.snapshot();
        expect(snap1.events).toHaveLength(2);
        expect(snap1.seq).toBe(2);

        emitter.emit('TASK_FAIL', 'a');

        const snap2 = emitter.snapshot();
        expect(snap2.events).toHaveLength(1);
        expect(snap2.events[0].type).toBe('TASK_FAIL');
        expect(snap2.seq).toBe(3);
    });

    it('should return all events via fullSnapshot()', () => {
        const emitter = new TelemetryEmitter();
        emitter.emit('TASK_DISPATCH', 'a');
        emitter.emit('TASK_COMPLETE', 'a');

        const full = emitter.fullSnapshot();
        expect(full.events).toHaveLength(2);
        expect(full.counters.totalEvents).toBe(2);
    });
});

describe('TelemetryEmitter - Subscriptions', () => {
    it('should notify subscribers on emit', () => {
        const emitter = new TelemetryEmitter();
        const handler = vi.fn();

        emitter.subscribe(handler);
        emitter.emit('TASK_DISPATCH', 'a');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_DISPATCH' }));
    });

    it('should support unsubscribe', () => {
        const emitter = new TelemetryEmitter();
        const handler = vi.fn();

        const unsub = emitter.subscribe(handler);
        emitter.emit('TASK_DISPATCH', 'a');
        unsub();
        emitter.emit('TASK_COMPLETE', 'a');

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not crash if subscriber throws', () => {
        const emitter = new TelemetryEmitter();
        emitter.subscribe(() => { throw new Error('bad subscriber'); });

        expect(() => emitter.emit('TASK_DISPATCH', 'a')).not.toThrow();
        expect(emitter.getEventCount()).toBe(1);
    });

    it('should support multiple subscribers', () => {
        const emitter = new TelemetryEmitter();
        const h1 = vi.fn();
        const h2 = vi.fn();

        emitter.subscribe(h1);
        emitter.subscribe(h2);
        emitter.emit('SYSTEM_BOOT', 'kernel');

        expect(h1).toHaveBeenCalledTimes(1);
        expect(h2).toHaveBeenCalledTimes(1);
    });
});

describe('TelemetryEmitter - Reset', () => {
    it('should clear all state on reset', () => {
        const emitter = new TelemetryEmitter();
        emitter.emit('TASK_DISPATCH', 'a');
        emitter.emit('TASK_COMPLETE', 'a');

        emitter.reset();

        expect(emitter.getEventCount()).toBe(0);
        expect(emitter.fullSnapshot().events).toHaveLength(0);
        expect(emitter.getCounters().tasksDispatched).toBe(0);
    });
});
