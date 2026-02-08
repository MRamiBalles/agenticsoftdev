
import { FlightRecorder } from './lib/flight_recorder';
import * as fs from 'fs';
import * as path from 'path';

// Clear existing ledger for a clean test
const LEDGER_PATH = path.join(process.cwd(), '.ai', 'audit', 'ledger.jsonl');
if (fs.existsSync(LEDGER_PATH)) {
    fs.unlinkSync(LEDGER_PATH);
}

const recorder = new FlightRecorder("ArchitectAgent-v2.1", "session-test-01");

// Entry 1
recorder.log(
    "User Request: /implement auth",
    "<thinking>User wants auth. Checking constitution... Auth requires Supabase. I will create a plan.</thinking>",
    "PLAN_DECISION",
    { file: "plan.md", status: "CREATED" },
    "SUCCESS"
);

// Entry 2
recorder.log(
    "File Change: src/secrets.ts",
    "<thinking>Scanning file content... Detected pattern 'sk-'. BLOCKING.</thinking>",
    "GOVERNANCE_CHECK",
    { file: "secrets.ts", violation: "CRITICAL_SECRET_EXPOSED" },
    "BLOCKED"
);

console.log("✅ Generated valid ledger with 2 entries.");
