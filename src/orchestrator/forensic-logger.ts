/**
 * Forensic Logger: The Flight Recorder
 * 
 * Implements the ForensicLogEntry schema from docs/governance/forensic_logging_spec.md
 * Append-only ledger with SHA-256 chain linking (blockchain-style integrity).
 * 
 * Compliance: ISO 42001 A.6.2.8, EU AI Act Art. 19
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { sanitizeOutput } from '../../scripts/security/input_sanitizer';

// ─── Schema (from forensic_logging_spec.md) ───

export type ActionType = 'FILE_WRITE' | 'SHELL_EXEC' | 'PLAN_DECISION';
export type Outcome = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export interface ForensicLogEntry {
    // Integrity
    id: string;
    timestamp: string;
    previous_hash: string;

    // Identity
    agent_id: string;
    session_id: string;

    // Context (Input)
    trigger_event: string;
    context_snapshot_hash: string;

    // Reasoning (The "Why")
    chain_of_thought: string;

    // Action (The "What")
    action_type: ActionType;
    action_payload: Record<string, unknown>;

    // Validation
    outcome: Outcome;
    governance_check_ref?: string;
}

// ─── Logger Implementation ───

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class ForensicLogger {
    private ledgerPath: string;
    private lastHash: string = GENESIS_HASH;
    private sessionId: string;

    constructor(projectRoot: string) {
        const auditDir = path.join(projectRoot, '.ai', 'audit');
        if (!fs.existsSync(auditDir)) {
            fs.mkdirSync(auditDir, { recursive: true });
        }
        this.ledgerPath = path.join(auditDir, 'ledger.jsonl');
        this.sessionId = crypto.randomUUID();

        // Resume chain from existing ledger
        this.lastHash = this.recoverLastHash();

        console.log(`📜 Forensic Logger initialized. Session: ${this.sessionId.slice(0, 8)}...`);
    }

    /**
     * Records a forensic log entry. Append-only, chain-linked.
     * Automatically redacts secrets from payload and chain_of_thought.
     */
    public record(params: {
        agent_id: string;
        trigger_event: string;
        context_snapshot: string;
        chain_of_thought: string;
        action_type: ActionType;
        action_payload: Record<string, unknown>;
        outcome: Outcome;
        governance_check_ref?: string;
    }): ForensicLogEntry {
        const entry: ForensicLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            previous_hash: this.lastHash,

            agent_id: params.agent_id,
            session_id: this.sessionId,

            trigger_event: params.trigger_event,
            context_snapshot_hash: this.sha256(params.context_snapshot),

            // Redact secrets from reasoning and payload
            chain_of_thought: sanitizeOutput(params.chain_of_thought),
            action_type: params.action_type,
            action_payload: JSON.parse(sanitizeOutput(JSON.stringify(params.action_payload))),

            outcome: params.outcome,
            governance_check_ref: params.governance_check_ref,
        };

        // Chain link: hash this entry to link the next one
        const entryJson = JSON.stringify(entry);
        this.lastHash = this.sha256(entryJson);

        // Append-only write
        fs.appendFileSync(this.ledgerPath, entryJson + '\n', 'utf-8');

        return entry;
    }

    /**
     * Verifies the integrity of the entire ledger chain.
     * Returns true if no entries have been tampered with.
     */
    public verifyChain(): { valid: boolean; entries: number; brokenAt?: number } {
        if (!fs.existsSync(this.ledgerPath)) {
            return { valid: true, entries: 0 };
        }

        const lines = fs.readFileSync(this.ledgerPath, 'utf-8')
            .trim()
            .split('\n')
            .filter(l => l.length > 0);

        let expectedHash = GENESIS_HASH;

        for (let i = 0; i < lines.length; i++) {
            const entry: ForensicLogEntry = JSON.parse(lines[i]);

            if (entry.previous_hash !== expectedHash) {
                console.error(`❌ Chain broken at entry ${i} (id: ${entry.id})`);
                return { valid: false, entries: lines.length, brokenAt: i };
            }

            expectedHash = this.sha256(lines[i]);
        }

        return { valid: true, entries: lines.length };
    }

    /**
     * Returns the current session ID for correlation.
     */
    public getSessionId(): string {
        return this.sessionId;
    }

    // ─── Private Helpers ───

    private sha256(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    private recoverLastHash(): string {
        if (!fs.existsSync(this.ledgerPath)) {
            return GENESIS_HASH;
        }

        const content = fs.readFileSync(this.ledgerPath, 'utf-8').trim();
        if (content.length === 0) {
            return GENESIS_HASH;
        }

        const lines = content.split('\n');
        const lastLine = lines[lines.length - 1];
        return this.sha256(lastLine);
    }
}
