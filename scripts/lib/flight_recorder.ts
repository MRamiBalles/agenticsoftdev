
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// CONFIGURATION
const LEDGER_PATH = path.join(process.cwd(), '.ai', 'audit', 'ledger.jsonl');

interface FlightRecorderEntry {
    id: string;
    timestamp: string;
    previous_hash: string;
    agent_id: string;
    session_id: string;
    trigger_event: string;
    chain_of_thought: string; // The "Reasoning"
    action_type: "FILE_WRITE" | "SHELL_EXEC" | "PLAN_DECISION" | "GOVERNANCE_CHECK";
    action_payload: any;
    outcome: "SUCCESS" | "FAILURE" | "BLOCKED";
}


interface OrgDebtReport {
    files: Array<{
        path: string;
        friction_score: number;
        risk_level: string;
    }>;
}

export class FlightRecorder {
    private agentId: string;
    private sessionId: string;
    private orgDebtPath = path.join(process.cwd(), 'src', 'data', 'org_debt_report.json');

    constructor(agentId: string, sessionId: string) {
        this.agentId = agentId;
        this.sessionId = sessionId;
        this.ensureLedgerExists();
    }

    private ensureLedgerExists() {
        const dir = path.dirname(LEDGER_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(LEDGER_PATH)) {
            fs.writeFileSync(LEDGER_PATH, ''); // Create empty file
        }
    }

    private getLastEntryHash(): string {
        try {
            const data = fs.readFileSync(LEDGER_PATH, 'utf-8');
            const lines = data.trim().split('\n');
            if (lines.length === 0) return 'GENESIS_HASH';

            const lastLine = lines[lines.length - 1];
            if (!lastLine) return 'GENESIS_HASH';

            // Calculate hash of the LAST line to chain it
            return crypto.createHash('sha256').update(lastLine).digest('hex');
        } catch (e) {
            return 'GENESIS_HASH';
        }
    }

    private redactSecrets(payload: any): any {
        // Simple heuristic redaction for the log (aligned with Phase C)
        const str = JSON.stringify(payload);
        // Regex for sk-, AKIA, etc.
        const redacted = str.replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_OPENAI_KEY]')
            .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]')
            .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]');
        return JSON.parse(redacted);
    }

    /**
     * Checks if the proposed action violates organizational peace treaties.
     * @param targetFile The file the agent attempts to modify.
     * @returns { allowed: boolean; reason?: string }
     */
    public checkGovernance(targetFile: string): { allowed: boolean; reason?: string } {
        try {
            if (!fs.existsSync(this.orgDebtPath)) {
                return { allowed: true }; // Fail-open if no intelligence data
            }

            const report: OrgDebtReport = JSON.parse(fs.readFileSync(this.orgDebtPath, 'utf-8'));
            // Normalize paths for comparison (simple endsWith check for robustness)
            const frictionEntry = report.files.find(f => targetFile.replace(/\\/g, '/').endsWith(f.path));

            // CONSTITUTIONAL THRESHOLD: 0.7 (70% contention)
            if (frictionEntry && frictionEntry.friction_score > 0.7) {
                return {
                    allowed: false,
                    reason: `⛔ GOVERNANCE LOCK: File '${targetFile}' is a Contention Zone (Friction: ${frictionEntry.friction_score}). Manual resolution by Accountable (RACI) required.`
                };
            }

            return { allowed: true };

        } catch (error) {
            console.error("⚠️ Error reading organizational intelligence:", error);
            return { allowed: true };
        }
    }

    public async interceptToolExecution(toolName: string, args: any): Promise<boolean> {
        // Only block write operations
        if (toolName === 'write_file' || toolName === 'replace_lines' || toolName === 'replace_file_content') {
            const targetPath = args.path || args.file || args.TargetFile || args.target_file;
            if (targetPath) {
                const governanceCheck = this.checkGovernance(targetPath);

                if (!governanceCheck.allowed) {
                    this.log(
                        "GOVERNANCE_INTERVENTION",
                        `Attempt to modify contested file: ${targetPath}`,
                        "GOVERNANCE_CHECK",
                        { outcome: 'BLOCKED', reason: governanceCheck.reason },
                        "BLOCKED"
                    );
                    throw new Error(governanceCheck.reason);
                }
            }
        }
        return true;
    }

    public log(
        trigger: string,
        reasoning: string,
        actionType: "FILE_WRITE" | "SHELL_EXEC" | "PLAN_DECISION" | "GOVERNANCE_CHECK" | "GOVERNANCE_INTERVENTION",
        payload: any,
        outcome: "SUCCESS" | "FAILURE" | "BLOCKED" = "SUCCESS"
    ) {
        const entry: FlightRecorderEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            previous_hash: this.getLastEntryHash(), // Cryptographic Chain
            agent_id: this.agentId,
            session_id: this.sessionId,
            trigger_event: trigger,
            chain_of_thought: reasoning,
            action_type: actionType as any,
            action_payload: this.redactSecrets(payload),
            outcome: outcome
        };

        const logLine = JSON.stringify(entry);
        fs.appendFileSync(LEDGER_PATH, logLine + '\n');

        console.log(`📼 [FlightRecorder] Logged action: ${actionType} (${entry.id.substring(0, 8)})`);
    }
}


// Example Usage (for testing)
// const recorder = new FlightRecorder("ArchitectAgent-01", "session-123");
// recorder.log("User Request", "I need to block bad code", "GOVERNANCE_CHECK", { violations: ["God Class"] }, "BLOCKED");
