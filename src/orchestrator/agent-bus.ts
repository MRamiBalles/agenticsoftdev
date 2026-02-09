/**
 * Agent Communication Protocol: Event Bus & Message Channels
 * 
 * Enables typed inter-agent communication during DAG execution:
 *   - Pub/Sub event bus with topic filtering
 *   - Scoped message channels (agent-to-agent)
 *   - Coordination primitives (Barrier, Signal)
 *   - RBAC enforcement on publish/subscribe
 *   - Message size limits (anti-context bombing)
 *   - Forensic logging of all message activity
 * 
 * Phase 4.2: Agent Communication Protocol
 * Compliance: constitution.md Art. I (Human Authority — messages are observable),
 *             Art. II (No Opaque Blobs — all messages logged)
 */

import { AgentRole } from './security-gate';

// ─── Types ───

/** Standard topic categories for the event bus */
export type MessageTopic =
    | 'task.completed'
    | 'task.failed'
    | 'task.spawned'
    | 'agent.signal'
    | 'agent.broadcast'
    | 'agent.request'
    | 'agent.response'
    | 'coordination.barrier'
    | 'coordination.signal'
    | string; // Allow custom topics with prefix convention

/** A typed message on the event bus */
export interface AgentMessage {
    /** Unique message ID */
    id: string;
    /** Topic/channel for routing */
    topic: MessageTopic;
    /** Sender agent ID (task ID or agent role) */
    sender: string;
    /** Sender's agent role (for RBAC) */
    senderRole: AgentRole;
    /** Optional target agent ID (for direct messages) */
    target?: string;
    /** Message payload */
    payload: Record<string, unknown>;
    /** Timestamp (epoch ms) */
    timestamp: number;
    /** TTL in ms (0 = no expiry) */
    ttlMs: number;
    /** Correlation ID for request/response patterns */
    correlationId?: string;
}

/** Policy configuration for the event bus */
export interface BusPolicy {
    /** Maximum message payload size in bytes (default: 10240 = 10KB) */
    maxMessageSize: number;
    /** Maximum messages per channel buffer (default: 100) */
    maxChannelDepth: number;
    /** Default message TTL in ms (default: 60000 = 60s) */
    defaultTtlMs: number;
    /** Whether to enforce RBAC on publish/subscribe (default: true) */
    enforceRBAC: boolean;
    /** Maximum total messages in the bus before oldest are evicted (default: 1000) */
    maxTotalMessages: number;
}

/** Result of a publish attempt */
export interface PublishResult {
    success: boolean;
    messageId?: string;
    reason?: string;
}

/** Subscription handle for cleanup */
export interface Subscription {
    id: string;
    topic: string;
    subscriber: string;
    unsubscribe: () => void;
}

/** Callback for message delivery */
export type MessageHandler = (message: AgentMessage) => void;

/** Barrier state for coordination */
export interface BarrierState {
    id: string;
    required: number;
    arrived: Set<string>;
    resolved: boolean;
    onResolve?: () => void;
    promise: Promise<void>;
}

/** Bus event callbacks for observability */
export interface BusCallbacks {
    /** Called when a message is successfully published */
    onPublish?: (message: AgentMessage) => void;
    /** Called when a message is delivered to a subscriber */
    onDeliver?: (message: AgentMessage, subscriber: string) => void;
    /** Called when a publish is rejected */
    onReject?: (sender: string, topic: string, reason: string) => void;
    /** Called when a barrier resolves */
    onBarrierResolved?: (barrierId: string, participants: string[]) => void;
}

// ─── RBAC: Topic Permissions ───

/** Which roles can publish to which topic prefixes */
const PUBLISH_PERMISSIONS: Record<string, AgentRole[]> = {
    'task.': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
    'agent.signal': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
    'agent.broadcast': ['architect', 'strategist'],
    'agent.request': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
    'agent.response': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
    'coordination.': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
};

/** Which roles can subscribe to which topic prefixes */
const SUBSCRIBE_PERMISSIONS: Record<string, AgentRole[]> = {
    'task.': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
    'agent.': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
    'coordination.': ['architect', 'builder', 'guardian', 'strategist', 'researcher', 'devops', 'designer'],
};

// ─── Default Policy ───

const DEFAULT_BUS_POLICY: BusPolicy = {
    maxMessageSize: 10240,   // 10KB
    maxChannelDepth: 100,
    defaultTtlMs: 60000,     // 60s
    enforceRBAC: true,
    maxTotalMessages: 1000,
};

// ─── Utility ───

let messageCounter = 0;

function generateMessageId(): string {
    messageCounter++;
    return `msg_${Date.now()}_${messageCounter}`;
}

function estimateSize(payload: Record<string, unknown>): number {
    return JSON.stringify(payload).length;
}

// ─── EventBus ───

export class EventBus {
    private policy: BusPolicy;
    private callbacks: BusCallbacks;
    private subscriptions: Map<string, { handler: MessageHandler; subscriber: string; role: AgentRole }[]> = new Map();
    private messageLog: AgentMessage[] = [];

    constructor(policy?: Partial<BusPolicy>, callbacks?: BusCallbacks) {
        this.policy = { ...DEFAULT_BUS_POLICY, ...policy };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Publish a message to a topic.
     * Validates RBAC, message size, and delivers to all matching subscribers.
     */
    public publish(
        topic: MessageTopic,
        sender: string,
        senderRole: AgentRole,
        payload: Record<string, unknown>,
        options?: { target?: string; correlationId?: string; ttlMs?: number },
    ): PublishResult {
        // Check 1: Message size limit
        const size = estimateSize(payload);
        if (size > this.policy.maxMessageSize) {
            const reason = `MESSAGE_TOO_LARGE: ${size} bytes exceeds max ${this.policy.maxMessageSize}`;
            this.callbacks.onReject?.(sender, topic, reason);
            return { success: false, reason };
        }

        // Check 2: RBAC — can this role publish to this topic?
        if (this.policy.enforceRBAC && !this.canPublish(senderRole, topic)) {
            const reason = `RBAC_DENIED: role [${senderRole}] cannot publish to [${topic}]`;
            this.callbacks.onReject?.(sender, topic, reason);
            return { success: false, reason };
        }

        // Build message
        const message: AgentMessage = {
            id: generateMessageId(),
            topic,
            sender,
            senderRole,
            target: options?.target,
            payload,
            timestamp: Date.now(),
            ttlMs: options?.ttlMs ?? this.policy.defaultTtlMs,
            correlationId: options?.correlationId,
        };

        // Store in log (with eviction)
        this.messageLog.push(message);
        if (this.messageLog.length > this.policy.maxTotalMessages) {
            this.messageLog.shift();
        }

        this.callbacks.onPublish?.(message);

        // Deliver to subscribers
        this.deliver(message);

        return { success: true, messageId: message.id };
    }

    /**
     * Subscribe to a topic pattern.
     * Returns a Subscription handle for cleanup.
     */
    public subscribe(
        topic: string,
        subscriber: string,
        role: AgentRole,
        handler: MessageHandler,
    ): Subscription | { success: false; reason: string } {
        // RBAC check
        if (this.policy.enforceRBAC && !this.canSubscribe(role, topic)) {
            return { success: false, reason: `RBAC_DENIED: role [${role}] cannot subscribe to [${topic}]` };
        }

        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, []);
        }

        const subEntry = { handler, subscriber, role };
        this.subscriptions.get(topic)!.push(subEntry);

        const subId = `sub_${subscriber}_${topic}_${Date.now()}`;

        return {
            id: subId,
            topic,
            subscriber,
            unsubscribe: () => {
                const subs = this.subscriptions.get(topic);
                if (subs) {
                    const idx = subs.indexOf(subEntry);
                    if (idx !== -1) subs.splice(idx, 1);
                }
            },
        };
    }

    /**
     * Get all messages for a topic (optionally filtered by target).
     * Expired messages are excluded.
     */
    public getMessages(topic: string, target?: string): AgentMessage[] {
        const now = Date.now();
        return this.messageLog.filter(msg => {
            if (msg.topic !== topic) return false;
            if (msg.ttlMs > 0 && now - msg.timestamp > msg.ttlMs) return false;
            if (target && msg.target && msg.target !== target) return false;
            return true;
        });
    }

    /**
     * Get all messages directed to a specific agent across all topics.
     */
    public getMessagesFor(agentId: string): AgentMessage[] {
        const now = Date.now();
        return this.messageLog.filter(msg => {
            if (msg.ttlMs > 0 && now - msg.timestamp > msg.ttlMs) return false;
            return msg.target === agentId || !msg.target;
        });
    }

    /**
     * Get the full message log (for forensic purposes).
     */
    public getMessageLog(): ReadonlyArray<AgentMessage> {
        return this.messageLog;
    }

    /**
     * Clear expired messages from the log.
     */
    public purgeExpired(): number {
        const now = Date.now();
        const before = this.messageLog.length;
        this.messageLog = this.messageLog.filter(msg =>
            msg.ttlMs === 0 || now - msg.timestamp <= msg.ttlMs,
        );
        return before - this.messageLog.length;
    }

    /**
     * Get the current policy.
     */
    public getPolicy(): BusPolicy {
        return { ...this.policy };
    }

    /**
     * Get subscription count for a topic.
     */
    public getSubscriberCount(topic: string): number {
        return this.subscriptions.get(topic)?.length ?? 0;
    }

    /**
     * Reset the bus (for testing).
     */
    public reset(): void {
        this.subscriptions.clear();
        this.messageLog = [];
    }

    // ─── Private ───

    private deliver(message: AgentMessage): void {
        // Exact topic match
        const exactSubs = this.subscriptions.get(message.topic) ?? [];
        for (const sub of exactSubs) {
            if (!message.target || message.target === sub.subscriber) {
                sub.handler(message);
                this.callbacks.onDeliver?.(message, sub.subscriber);
            }
        }

        // Wildcard: subscribers to prefix patterns (e.g., 'task.*' matches 'task.completed')
        for (const [pattern, subs] of this.subscriptions) {
            if (pattern === message.topic) continue; // already handled
            if (pattern.endsWith('*') && message.topic.startsWith(pattern.slice(0, -1))) {
                for (const sub of subs) {
                    if (!message.target || message.target === sub.subscriber) {
                        sub.handler(message);
                        this.callbacks.onDeliver?.(message, sub.subscriber);
                    }
                }
            }
        }
    }

    private canPublish(role: AgentRole, topic: string): boolean {
        for (const [prefix, roles] of Object.entries(PUBLISH_PERMISSIONS)) {
            if (topic.startsWith(prefix) && roles.includes(role)) {
                return true;
            }
        }
        return false;
    }

    private canSubscribe(role: AgentRole, topic: string): boolean {
        // Strip wildcard for permission check
        const checkTopic = topic.endsWith('*') ? topic.slice(0, -1) : topic;
        for (const [prefix, roles] of Object.entries(SUBSCRIBE_PERMISSIONS)) {
            if (checkTopic.startsWith(prefix) && roles.includes(role)) {
                return true;
            }
        }
        return false;
    }
}

// ─── AgentMailbox: Scoped Interface for a Single Agent ───

/**
 * A scoped view of the EventBus for a single agent.
 * Agents interact with the bus only through their mailbox.
 */
export class AgentMailbox {
    private bus: EventBus;
    private agentId: string;
    private role: AgentRole;
    private subscriptions: Subscription[] = [];

    constructor(bus: EventBus, agentId: string, role: AgentRole) {
        this.bus = bus;
        this.agentId = agentId;
        this.role = role;
    }

    /** Publish a message from this agent */
    public send(
        topic: MessageTopic,
        payload: Record<string, unknown>,
        options?: { target?: string; correlationId?: string; ttlMs?: number },
    ): PublishResult {
        return this.bus.publish(topic, this.agentId, this.role, payload, options);
    }

    /** Subscribe to a topic */
    public on(topic: string, handler: MessageHandler): Subscription | { success: false; reason: string } {
        const sub = this.bus.subscribe(topic, this.agentId, this.role, handler);
        if ('unsubscribe' in sub) {
            this.subscriptions.push(sub);
        }
        return sub;
    }

    /** Get messages directed to this agent */
    public inbox(): AgentMessage[] {
        return this.bus.getMessagesFor(this.agentId);
    }

    /** Get messages on a specific topic */
    public read(topic: string): AgentMessage[] {
        return this.bus.getMessages(topic, this.agentId);
    }

    /** Cleanup all subscriptions */
    public dispose(): void {
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        this.subscriptions = [];
    }

    public getAgentId(): string {
        return this.agentId;
    }

    public getRole(): AgentRole {
        return this.role;
    }
}

// ─── Coordination Primitives ───

/**
 * Barrier: blocks until N participants have arrived.
 */
export class Barrier {
    private barriers: Map<string, BarrierState> = new Map();
    private callbacks: BusCallbacks;

    constructor(callbacks?: BusCallbacks) {
        this.callbacks = callbacks ?? {};
    }

    /**
     * Create a barrier that requires `count` participants.
     */
    public create(barrierId: string, count: number): BarrierState {
        let resolveBarrier: () => void;
        const promise = new Promise<void>(resolve => {
            resolveBarrier = resolve;
        });

        const state: BarrierState = {
            id: barrierId,
            required: count,
            arrived: new Set(),
            resolved: false,
            onResolve: resolveBarrier!,
            promise,
        };

        this.barriers.set(barrierId, state);
        return state;
    }

    /**
     * Signal that a participant has arrived at the barrier.
     * Returns true if the barrier is now resolved.
     */
    public arrive(barrierId: string, participantId: string): boolean {
        const state = this.barriers.get(barrierId);
        if (!state || state.resolved) return false;

        state.arrived.add(participantId);

        if (state.arrived.size >= state.required) {
            state.resolved = true;
            state.onResolve?.();
            this.callbacks.onBarrierResolved?.(barrierId, Array.from(state.arrived));
            return true;
        }

        return false;
    }

    /**
     * Wait for a barrier to resolve.
     */
    public async wait(barrierId: string): Promise<boolean> {
        const state = this.barriers.get(barrierId);
        if (!state) return false;
        if (state.resolved) return true;
        await state.promise;
        return true;
    }

    /**
     * Get barrier state.
     */
    public getState(barrierId: string): BarrierState | undefined {
        return this.barriers.get(barrierId);
    }

    /**
     * Reset all barriers (for testing).
     */
    public reset(): void {
        this.barriers.clear();
    }
}

// ─── SignalFlag: One-Shot Notification ───

/**
 * Signal: a one-shot flag that can be raised by one agent and awaited by others.
 */
export class SignalFlag {
    private signals: Map<string, { raised: boolean; resolve?: () => void; promise: Promise<void> }> = new Map();

    /**
     * Create a signal.
     */
    public create(signalId: string): void {
        let resolve: () => void;
        const promise = new Promise<void>(r => { resolve = r; });
        this.signals.set(signalId, { raised: false, resolve: resolve!, promise });
    }

    /**
     * Raise a signal.
     */
    public raise(signalId: string): boolean {
        const sig = this.signals.get(signalId);
        if (!sig || sig.raised) return false;
        sig.raised = true;
        sig.resolve?.();
        return true;
    }

    /**
     * Wait for a signal to be raised.
     */
    public async wait(signalId: string): Promise<boolean> {
        const sig = this.signals.get(signalId);
        if (!sig) return false;
        if (sig.raised) return true;
        await sig.promise;
        return true;
    }

    /**
     * Check if a signal has been raised (non-blocking).
     */
    public isRaised(signalId: string): boolean {
        return this.signals.get(signalId)?.raised ?? false;
    }

    /**
     * Reset all signals (for testing).
     */
    public reset(): void {
        this.signals.clear();
    }
}
