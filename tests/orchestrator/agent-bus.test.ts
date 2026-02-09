/**
 * Agent Communication Protocol Tests
 * 
 * Validates: pub/sub delivery, topic filtering, RBAC enforcement,
 * message size limits, wildcard subscriptions, AgentMailbox scoping,
 * Barrier synchronization, SignalFlag coordination, message TTL.
 * 
 * Phase 4.2: Agent Communication Protocol
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    EventBus,
    AgentMailbox,
    Barrier,
    SignalFlag,
    AgentMessage,
    PublishResult,
    BusCallbacks,
} from '../../src/orchestrator/agent-bus';

// ─── EventBus: Core Pub/Sub ───

describe('EventBus - Pub/Sub', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus({ enforceRBAC: false });
    });

    it('should publish a message and return success', () => {
        const result = bus.publish('task.completed', 'agent-1', 'builder', { taskId: 'x' });
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
    });

    it('should deliver messages to subscribers', () => {
        const received: AgentMessage[] = [];
        bus.subscribe('task.completed', 'listener', 'guardian', (msg) => received.push(msg));

        bus.publish('task.completed', 'agent-1', 'builder', { taskId: 'x' });

        expect(received).toHaveLength(1);
        expect(received[0].sender).toBe('agent-1');
        expect(received[0].payload.taskId).toBe('x');
    });

    it('should not deliver messages to wrong topic subscribers', () => {
        const received: AgentMessage[] = [];
        bus.subscribe('task.failed', 'listener', 'guardian', (msg) => received.push(msg));

        bus.publish('task.completed', 'agent-1', 'builder', { taskId: 'x' });

        expect(received).toHaveLength(0);
    });

    it('should deliver to multiple subscribers', () => {
        const received1: AgentMessage[] = [];
        const received2: AgentMessage[] = [];

        bus.subscribe('task.completed', 'listener-1', 'guardian', (msg) => received1.push(msg));
        bus.subscribe('task.completed', 'listener-2', 'architect', (msg) => received2.push(msg));

        bus.publish('task.completed', 'agent-1', 'builder', { taskId: 'x' });

        expect(received1).toHaveLength(1);
        expect(received2).toHaveLength(1);
    });

    it('should support unsubscribe', () => {
        const received: AgentMessage[] = [];
        const sub = bus.subscribe('task.completed', 'listener', 'guardian', (msg) => received.push(msg));

        bus.publish('task.completed', 'agent-1', 'builder', { first: true });
        expect(received).toHaveLength(1);

        if ('unsubscribe' in sub) sub.unsubscribe();

        bus.publish('task.completed', 'agent-1', 'builder', { second: true });
        expect(received).toHaveLength(1); // no new delivery
    });

    it('should support wildcard subscriptions', () => {
        const received: AgentMessage[] = [];
        bus.subscribe('task.*', 'listener', 'guardian', (msg) => received.push(msg));

        bus.publish('task.completed', 'agent-1', 'builder', { a: 1 });
        bus.publish('task.failed', 'agent-1', 'builder', { b: 2 });
        bus.publish('agent.signal', 'agent-1', 'builder', { c: 3 });

        expect(received).toHaveLength(2);
    });

    it('should store messages in the log', () => {
        bus.publish('task.completed', 'a', 'builder', { x: 1 });
        bus.publish('task.failed', 'b', 'builder', { y: 2 });

        const log = bus.getMessageLog();
        expect(log).toHaveLength(2);
    });

    it('should filter messages by topic via getMessages', () => {
        bus.publish('task.completed', 'a', 'builder', { x: 1 });
        bus.publish('task.failed', 'b', 'builder', { y: 2 });

        const completed = bus.getMessages('task.completed');
        expect(completed).toHaveLength(1);
        expect(completed[0].sender).toBe('a');
    });

    it('should support targeted messages (direct)', () => {
        const received: AgentMessage[] = [];
        bus.subscribe('agent.signal', 'target-agent', 'guardian', (msg) => received.push(msg));
        bus.subscribe('agent.signal', 'other-agent', 'builder', (msg) => received.push(msg));

        bus.publish('agent.signal', 'sender', 'architect', { data: 'hello' }, { target: 'target-agent' });

        // Only target-agent should receive it
        expect(received).toHaveLength(1);
        expect(received[0].payload.data).toBe('hello');
    });

    it('should return subscriber count', () => {
        bus.subscribe('task.completed', 'a', 'builder', () => {});
        bus.subscribe('task.completed', 'b', 'guardian', () => {});
        bus.subscribe('task.failed', 'c', 'architect', () => {});

        expect(bus.getSubscriberCount('task.completed')).toBe(2);
        expect(bus.getSubscriberCount('task.failed')).toBe(1);
        expect(bus.getSubscriberCount('nonexistent')).toBe(0);
    });

    it('should reset all state', () => {
        bus.subscribe('task.completed', 'a', 'builder', () => {});
        bus.publish('task.completed', 'a', 'builder', { x: 1 });

        bus.reset();

        expect(bus.getMessageLog()).toHaveLength(0);
        expect(bus.getSubscriberCount('task.completed')).toBe(0);
    });
});

// ─── EventBus: Message Size Limits ───

describe('EventBus - Message Size Limits', () => {
    it('should reject messages exceeding max size', () => {
        const bus = new EventBus({ maxMessageSize: 50, enforceRBAC: false });

        const bigPayload = { data: 'x'.repeat(100) };
        const result = bus.publish('task.completed', 'a', 'builder', bigPayload);

        expect(result.success).toBe(false);
        expect(result.reason).toContain('MESSAGE_TOO_LARGE');
    });

    it('should accept messages within size limit', () => {
        const bus = new EventBus({ maxMessageSize: 1000, enforceRBAC: false });

        const result = bus.publish('task.completed', 'a', 'builder', { small: true });

        expect(result.success).toBe(true);
    });
});

// ─── EventBus: RBAC ───

describe('EventBus - RBAC Enforcement', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus({ enforceRBAC: true });
    });

    it('should allow architect to broadcast', () => {
        const result = bus.publish('agent.broadcast', 'arch-1', 'architect', { msg: 'hello' });
        expect(result.success).toBe(true);
    });

    it('should reject builder from broadcasting', () => {
        const result = bus.publish('agent.broadcast', 'build-1', 'builder', { msg: 'hello' });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('RBAC_DENIED');
    });

    it('should allow all roles to publish to task topics', () => {
        const roles: Array<'architect' | 'builder' | 'guardian' | 'strategist' | 'researcher' | 'devops' | 'designer'> =
            ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'];

        for (const role of roles) {
            const result = bus.publish('task.completed', `agent-${role}`, role, { x: 1 });
            expect(result.success).toBe(true);
        }
    });

    it('should allow all roles to subscribe to task topics', () => {
        const roles: Array<'architect' | 'builder' | 'guardian' | 'strategist' | 'researcher' | 'devops' | 'designer'> =
            ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'];

        for (const role of roles) {
            const sub = bus.subscribe('task.completed', `agent-${role}`, role, () => {});
            expect('unsubscribe' in sub).toBe(true);
        }
    });

    it('should reject publish to unknown topic prefix', () => {
        const result = bus.publish('unknown.topic', 'a', 'builder', { x: 1 });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('RBAC_DENIED');
    });

    it('should reject subscribe to unknown topic prefix', () => {
        const sub = bus.subscribe('unknown.topic', 'a', 'builder', () => {});
        expect('success' in sub && !sub.success).toBe(true);
    });
});

// ─── EventBus: TTL & Eviction ───

describe('EventBus - TTL & Eviction', () => {
    it('should evict oldest messages when maxTotalMessages exceeded', () => {
        const bus = new EventBus({ maxTotalMessages: 3, enforceRBAC: false });

        bus.publish('task.completed', 'a', 'builder', { n: 1 });
        bus.publish('task.completed', 'a', 'builder', { n: 2 });
        bus.publish('task.completed', 'a', 'builder', { n: 3 });
        bus.publish('task.completed', 'a', 'builder', { n: 4 });

        const log = bus.getMessageLog();
        expect(log).toHaveLength(3);
        expect((log[0].payload as Record<string, number>).n).toBe(2); // oldest evicted
    });

    it('should filter expired messages in getMessages', async () => {
        const bus = new EventBus({ defaultTtlMs: 50, enforceRBAC: false });

        bus.publish('task.completed', 'a', 'builder', { x: 1 });
        await new Promise(resolve => setTimeout(resolve, 80));

        const msgs = bus.getMessages('task.completed');
        expect(msgs).toHaveLength(0);
    });

    it('should purge expired messages', async () => {
        const bus = new EventBus({ defaultTtlMs: 30, enforceRBAC: false });

        bus.publish('task.completed', 'a', 'builder', { x: 1 });
        bus.publish('task.completed', 'a', 'builder', { x: 2 });
        await new Promise(resolve => setTimeout(resolve, 50));

        const purged = bus.purgeExpired();
        expect(purged).toBe(2);
        expect(bus.getMessageLog()).toHaveLength(0);
    });
});

// ─── EventBus: Callbacks ───

describe('EventBus - Callbacks', () => {
    it('should fire onPublish callback', () => {
        const published: AgentMessage[] = [];
        const bus = new EventBus({ enforceRBAC: false }, {
            onPublish: (msg) => published.push(msg),
        });

        bus.publish('task.completed', 'a', 'builder', { x: 1 });
        expect(published).toHaveLength(1);
    });

    it('should fire onDeliver callback', () => {
        const delivered: { msg: AgentMessage; sub: string }[] = [];
        const bus = new EventBus({ enforceRBAC: false }, {
            onDeliver: (msg, sub) => delivered.push({ msg, sub }),
        });

        bus.subscribe('task.completed', 'listener', 'guardian', () => {});
        bus.publish('task.completed', 'a', 'builder', { x: 1 });

        expect(delivered).toHaveLength(1);
        expect(delivered[0].sub).toBe('listener');
    });

    it('should fire onReject callback for size violations', () => {
        const rejected: { sender: string; topic: string; reason: string }[] = [];
        const bus = new EventBus({ maxMessageSize: 10, enforceRBAC: false }, {
            onReject: (sender, topic, reason) => rejected.push({ sender, topic, reason }),
        });

        bus.publish('task.completed', 'a', 'builder', { big: 'xxxxxxxxxxxx' });
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toContain('MESSAGE_TOO_LARGE');
    });

    it('should fire onReject callback for RBAC violations', () => {
        const rejected: string[] = [];
        const bus = new EventBus({ enforceRBAC: true }, {
            onReject: (_s, _t, reason) => rejected.push(reason),
        });

        bus.publish('agent.broadcast', 'b', 'builder', { x: 1 });
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toContain('RBAC_DENIED');
    });
});

// ─── AgentMailbox ───

describe('AgentMailbox', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus({ enforceRBAC: false });
    });

    it('should send messages from the agent', () => {
        const mailbox = new AgentMailbox(bus, 'agent-1', 'builder');
        const result = mailbox.send('task.completed', { taskId: 'x' });

        expect(result.success).toBe(true);
        expect(bus.getMessageLog()).toHaveLength(1);
        expect(bus.getMessageLog()[0].sender).toBe('agent-1');
    });

    it('should subscribe and receive messages', () => {
        const mailbox = new AgentMailbox(bus, 'listener', 'guardian');
        const received: AgentMessage[] = [];

        mailbox.on('task.completed', (msg) => received.push(msg));
        bus.publish('task.completed', 'sender', 'builder', { data: 'hi' });

        expect(received).toHaveLength(1);
    });

    it('should read inbox (messages for this agent)', () => {
        const mailbox = new AgentMailbox(bus, 'agent-1', 'builder');

        bus.publish('agent.signal', 'other', 'architect', { msg: 'for you' }, { target: 'agent-1' });
        bus.publish('agent.signal', 'other', 'architect', { msg: 'not for you' }, { target: 'agent-2' });

        const inbox = mailbox.inbox();
        // Should include the targeted message and any broadcast (non-targeted)
        expect(inbox.some(m => (m.payload as Record<string, string>).msg === 'for you')).toBe(true);
    });

    it('should read messages by topic', () => {
        const mailbox = new AgentMailbox(bus, 'agent-1', 'builder');

        bus.publish('task.completed', 'x', 'builder', { a: 1 });
        bus.publish('task.failed', 'x', 'builder', { b: 2 });

        const completed = mailbox.read('task.completed');
        expect(completed).toHaveLength(1);
    });

    it('should dispose all subscriptions', () => {
        const mailbox = new AgentMailbox(bus, 'listener', 'guardian');
        const received: AgentMessage[] = [];

        mailbox.on('task.completed', (msg) => received.push(msg));
        bus.publish('task.completed', 'a', 'builder', { first: true });
        expect(received).toHaveLength(1);

        mailbox.dispose();

        bus.publish('task.completed', 'a', 'builder', { second: true });
        expect(received).toHaveLength(1); // no new delivery
    });

    it('should expose agent metadata', () => {
        const mailbox = new AgentMailbox(bus, 'agent-1', 'builder');
        expect(mailbox.getAgentId()).toBe('agent-1');
        expect(mailbox.getRole()).toBe('builder');
    });
});

// ─── Barrier ───

describe('Barrier', () => {
    it('should create a barrier with required count', () => {
        const barrier = new Barrier();
        const state = barrier.create('b1', 3);

        expect(state.required).toBe(3);
        expect(state.arrived.size).toBe(0);
        expect(state.resolved).toBe(false);
    });

    it('should resolve when all participants arrive', () => {
        const barrier = new Barrier();
        barrier.create('b1', 2);

        expect(barrier.arrive('b1', 'agent-1')).toBe(false); // not yet
        expect(barrier.arrive('b1', 'agent-2')).toBe(true);  // resolved

        const state = barrier.getState('b1')!;
        expect(state.resolved).toBe(true);
        expect(state.arrived.size).toBe(2);
    });

    it('should not double-count the same participant', () => {
        const barrier = new Barrier();
        barrier.create('b1', 2);

        barrier.arrive('b1', 'agent-1');
        barrier.arrive('b1', 'agent-1'); // duplicate

        const state = barrier.getState('b1')!;
        expect(state.arrived.size).toBe(1);
        expect(state.resolved).toBe(false);
    });

    it('should return false for non-existent barrier', () => {
        const barrier = new Barrier();
        expect(barrier.arrive('nonexistent', 'agent-1')).toBe(false);
    });

    it('should await resolution via wait()', async () => {
        const barrier = new Barrier();
        barrier.create('b1', 2);

        // Start waiting in background
        const waitPromise = barrier.wait('b1');

        // Arrive from two participants
        barrier.arrive('b1', 'agent-1');
        barrier.arrive('b1', 'agent-2');

        const resolved = await waitPromise;
        expect(resolved).toBe(true);
    });

    it('should immediately resolve wait() for already-resolved barrier', async () => {
        const barrier = new Barrier();
        barrier.create('b1', 1);
        barrier.arrive('b1', 'agent-1');

        const resolved = await barrier.wait('b1');
        expect(resolved).toBe(true);
    });

    it('should fire onBarrierResolved callback', () => {
        const resolved: { id: string; participants: string[] }[] = [];
        const barrier = new Barrier({
            onBarrierResolved: (id, participants) => resolved.push({ id, participants }),
        });

        barrier.create('b1', 2);
        barrier.arrive('b1', 'a');
        barrier.arrive('b1', 'b');

        expect(resolved).toHaveLength(1);
        expect(resolved[0].id).toBe('b1');
        expect(resolved[0].participants).toContain('a');
        expect(resolved[0].participants).toContain('b');
    });
});

// ─── SignalFlag ───

describe('SignalFlag', () => {
    it('should create and check unraised signal', () => {
        const signal = new SignalFlag();
        signal.create('s1');

        expect(signal.isRaised('s1')).toBe(false);
    });

    it('should raise a signal', () => {
        const signal = new SignalFlag();
        signal.create('s1');

        const raised = signal.raise('s1');
        expect(raised).toBe(true);
        expect(signal.isRaised('s1')).toBe(true);
    });

    it('should not double-raise', () => {
        const signal = new SignalFlag();
        signal.create('s1');

        signal.raise('s1');
        const secondRaise = signal.raise('s1');
        expect(secondRaise).toBe(false);
    });

    it('should return false for non-existent signal', () => {
        const signal = new SignalFlag();
        expect(signal.isRaised('nonexistent')).toBe(false);
        expect(signal.raise('nonexistent')).toBe(false);
    });

    it('should await signal via wait()', async () => {
        const signal = new SignalFlag();
        signal.create('s1');

        const waitPromise = signal.wait('s1');
        signal.raise('s1');

        const result = await waitPromise;
        expect(result).toBe(true);
    });

    it('should immediately resolve wait() for already-raised signal', async () => {
        const signal = new SignalFlag();
        signal.create('s1');
        signal.raise('s1');

        const result = await signal.wait('s1');
        expect(result).toBe(true);
    });

    it('should return false for wait on non-existent signal', async () => {
        const signal = new SignalFlag();
        const result = await signal.wait('nonexistent');
        expect(result).toBe(false);
    });
});
