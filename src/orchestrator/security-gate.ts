/**
 * Security Gate: Pre-Dispatch Validation & RBAC
 * 
 * Every task must pass through this gate before reaching an agent.
 * Enforces:
 *   1. Input sanitization (anti-prompt injection)
 *   2. Command whitelist validation
 *   3. Per-agent permission model (RBAC)
 *   4. Output sanitization (secret redaction)
 * 
 * Compliance: ISO 42001 - Agent Containment, constitution.md Art. I
 */

import { sanitizeInput, validateCommand, sanitizeOutput, SanitizeResult } from '../../scripts/security/input_sanitizer';

// ─── RBAC Permission Model ───

export type AgentRole = 'architect' | 'builder' | 'guardian' | 'strategist' | 'researcher' | 'devops' | 'designer';
export type Permission = 'PLAN_DECISION' | 'FILE_WRITE' | 'SHELL_EXEC' | 'READ_ONLY' | 'AUDIT' | 'WEB_SEARCH' | 'NETWORK_OUTBOUND' | 'DOCKER_CONTROL';

export const ROLE_PERMISSIONS: Record<AgentRole, Permission[]> = {
    architect: ['PLAN_DECISION', 'READ_ONLY'],
    builder: ['FILE_WRITE', 'SHELL_EXEC', 'READ_ONLY'],
    guardian: ['READ_ONLY', 'AUDIT'],
    strategist: ['PLAN_DECISION', 'READ_ONLY', 'AUDIT'],
    researcher: ['READ_ONLY', 'WEB_SEARCH', 'NETWORK_OUTBOUND'],
    devops: ['FILE_WRITE', 'SHELL_EXEC', 'DOCKER_CONTROL', 'READ_ONLY'],
    designer: ['FILE_WRITE', 'READ_ONLY'],
};

// Map task types to required permissions
export const TASK_PERMISSION_MAP: Record<string, Permission> = {
    'PLAN': 'PLAN_DECISION',
    'CODE': 'FILE_WRITE',
    'AUDIT': 'AUDIT',
    'SHELL': 'SHELL_EXEC',
    'RESEARCH': 'WEB_SEARCH',
    'DESIGN': 'FILE_WRITE',
    'INFRA_PROVISION': 'DOCKER_CONTROL',
    'TEST': 'AUDIT',
    'REVIEW': 'AUDIT',
    'DEPLOY': 'DOCKER_CONTROL',
};

// ─── Gate Result ───

export interface GateVerdict {
    allowed: boolean;
    reason: string;
    sanitizedPayload: Record<string, unknown>;
    threats: string[];
    atdiPenalty: number;
}

// ─── Security Gate ───

export class SecurityGate {
    private violations: { timestamp: string; agent: string; reason: string }[] = [];

    constructor() {
        console.log('🛡️ Security Gate armed.');
    }

    /**
     * Validates a task before dispatch.
     * Returns a verdict with sanitized payload or rejection reason.
     */
    public validate(params: {
        agentRole: AgentRole;
        taskType: string;
        payload: Record<string, unknown>;
        command?: string;
    }): GateVerdict {
        const threats: string[] = [];
        let atdiPenalty = 0;

        // ── Check 1: RBAC Permission ──
        const requiredPermission = TASK_PERMISSION_MAP[params.taskType];
        if (requiredPermission && !this.hasPermission(params.agentRole, requiredPermission)) {
            const reason = `RBAC violation: Agent [${params.agentRole}] lacks permission [${requiredPermission}] for task type [${params.taskType}]`;
            this.logViolation(params.agentRole, reason);
            return {
                allowed: false,
                reason,
                sanitizedPayload: {},
                threats: [reason],
                atdiPenalty: 500, // Critical: Constitutional violation
            };
        }

        // ── Check 2: Input Sanitization ──
        const payloadStr = JSON.stringify(params.payload);
        const sanitizeResult: SanitizeResult = sanitizeInput(payloadStr);

        if (!sanitizeResult.safe) {
            threats.push(...sanitizeResult.threats);
            atdiPenalty += 100; // Injection attempt
            console.warn(`⚠️ Injection patterns detected in task payload for agent [${params.agentRole}]`);
        }

        // ── Check 3: Command Whitelist (if SHELL_EXEC) ──
        if (params.command) {
            if (!validateCommand(params.command)) {
                const reason = `Command blocked by firewall: ${params.command}`;
                threats.push(reason);
                atdiPenalty += 200; // Unauthorized command
                this.logViolation(params.agentRole, reason);
                return {
                    allowed: false,
                    reason,
                    sanitizedPayload: {},
                    threats,
                    atdiPenalty,
                };
            }
        }

        // ── Check 4: Payload Size Guard (prevent context bombing) ──
        const MAX_PAYLOAD_SIZE = 1024 * 100; // 100KB
        if (payloadStr.length > MAX_PAYLOAD_SIZE) {
            const reason = `Payload exceeds maximum size (${payloadStr.length} > ${MAX_PAYLOAD_SIZE})`;
            threats.push(reason);
            atdiPenalty += 50;
        }

        // ── Verdict ──
        let sanitizedPayload: Record<string, unknown>;
        try {
            sanitizedPayload = JSON.parse(sanitizeResult.sanitized);
        } catch {
            sanitizedPayload = { raw: sanitizeResult.sanitized };
            threats.push('Payload corrupted after sanitization — could not re-parse');
            atdiPenalty += 50;
        }
        const allowed = atdiPenalty < 200; // Block if penalty >= 200

        if (!allowed) {
            this.logViolation(params.agentRole, `Blocked: cumulative ATDI penalty ${atdiPenalty}`);
        }

        return {
            allowed,
            reason: allowed ? 'GATE_PASSED' : `Blocked: ATDI penalty ${atdiPenalty} exceeds threshold`,
            sanitizedPayload,
            threats,
            atdiPenalty,
        };
    }

    /**
     * Sanitizes agent output before it leaves the sandbox.
     * Prevents secret leakage.
     */
    public sanitizeAgentOutput(output: string): string {
        return sanitizeOutput(output);
    }

    /**
     * Checks if a role has a specific permission.
     */
    public hasPermission(role: AgentRole, permission: Permission): boolean {
        return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
    }

    /**
     * Returns all recorded violations for audit.
     */
    public getViolations(): { timestamp: string; agent: string; reason: string }[] {
        return [...this.violations];
    }

    // ─── Private ───

    private logViolation(agent: string, reason: string): void {
        this.violations.push({
            timestamp: new Date().toISOString(),
            agent,
            reason,
        });
        console.error(`🚨 SECURITY VIOLATION [${agent}]: ${reason}`);
    }
}
