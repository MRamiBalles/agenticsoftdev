
import * as fs from 'fs';
import * as path from 'path';

const LEDGER_PATH = path.join(process.cwd(), '.ai', 'audit', 'ledger.jsonl');
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'data', 'audit_log.json');

interface ForensicLogEntry {
    id: string;
    timestamp: string;
    previous_hash: string;
    agent_id: string;
    session_id: string;
    trigger_event: string;
    chain_of_thought: string;
    action_type: string;
    action_payload: any;
    outcome: "SUCCESS" | "FAILURE" | "BLOCKED";
}

function publishLog() {
    if (!fs.existsSync(LEDGER_PATH)) {
        console.warn("No ledger found. Creating empty log.");
        fs.writeFileSync(OUTPUT_PATH, '[]');
        return;
    }

    const fileContent = fs.readFileSync(LEDGER_PATH, 'utf-8');
    const lines = fileContent.trim().split('\n');
    const logs: ForensicLogEntry[] = [];

    lines.forEach(line => {
        if (line.trim()) {
            try {
                logs.push(JSON.parse(line));
            } catch (e) {
                console.error("Failed to parse log line:", line);
            }
        }
    });

    // Ensure output directory exists
    const outDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(logs, null, 2));
    console.log(`✅ Published ${logs.length} forensic logs to ${OUTPUT_PATH}`);
}

publishLog();
