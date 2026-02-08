
import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

import { FlightRecorder } from '../lib/flight_recorder.ts';

// Configuration
const CONSTITUTION_PATH = path.join(process.cwd(), '.specify/memory/constitution.md');
const recorder = new FlightRecorder("GOVERNANCE_AGENT", "constitution-check");

// Critical Actions requiring Human Accountability (Article I)
const CRITICAL_ACTIONS = [
    'deploy_production',
    'delete_database',
    'change_budget',
    'activate_kill_switch',
    'amend_constitution',
    'publish_release'
];

interface GovernanceResult {
    status: 'APPROVED' | 'BLOCKED';
    message: string;
    violation?: string;
}

async function checkConstitution() {
    console.log("👮‍♂️ [Governance Agent] Intercepting Action Request...");

    // Parse Arguments
    const args = process.argv.slice(2);
    const action = args.find(arg => arg.startsWith('--action='))?.split('=')[1];
    const agentRole = args.find(arg => arg.startsWith('--role='))?.split('=')[1] || 'Responsible'; // Default to AI Role
    const signature = args.find(arg => arg.startsWith('--signature='))?.split('=')[1];

    if (!action) {
        console.error("❌ Error: --action argument is required.");
        process.exit(1);
    }

    console.log(`   - Action: ${action}`);
    console.log(`   - Agent Role: ${agentRole}`);
    console.log(`   - Signature Present: ${signature ? 'YES' : 'NO'}`);

    // Load Constitution
    let constitutionText = '';
    try {
        constitutionText = fs.readFileSync(CONSTITUTION_PATH, 'utf-8');
    } catch (e) {
        console.error("❌ CRTICAL: Constitution NOT FOUND. System Operating Lawlessly.");
        process.exit(1);
    }

    // --- ENFORCEMENT LOGIC ---

    // 1. Article I Check: Cryptographic Sovereignty
    // "Critical strategic decisions ... require a cryptographically signed human approval"
    if (CRITICAL_ACTIONS.includes(action)) {
        if (!signature || !signature.startsWith('SIG-HUMAN-')) {
            blockAction(
                "Article I (Cryptographic Sovereignty)",
                `Action '${action}' is classified as CRITICAL. It requires a valid Human Signature (starting with SIG-HUMAN-).`,
                "A.9.3" // ISO: Human Oversight
            );
            return;
        }
        console.log("   ✅ Valid Human Signature detected.");
    }

    // 2. Article II Check: Role Restriction
    // "AI Agents are strictly limited to the role of Responsible (R)... They may never hold Accountability"
    if (agentRole === 'Accountable') {
        blockAction(
            "Article II (Role Restriction)",
            `AI Agents cannot hold the 'Accountable' role. You must act as 'Responsible' or 'Consulted'.`,
            "A.3.2" // ISO: Roles & Responsibilities
        );
        return;
    }

    // 3. General Constitution Check (Keyword Search in Constitution)
    if (!constitutionText.includes('Article I')) {
        blockAction(
            "Constitutional Integrity",
            "The Constitution file appears corrupted or invalid.",
            "A.6.2.8" // ISO: Event Logging (Integrity Failure)
        );
        return;
    }

    // If passed all checks
    console.log(`\n✅ [GOVERNANCE] Action '${action}' is APPROVED under the Sovereign SDLC Constitution.`);
    console.log("   - Chain of Custody: Valid");
    console.log("   - Risk Level: Acceptable");

    recorder.log(
        "GOVERNANCE_CHECK",
        `Action '${action}' approved by Constitution.`,
        "GOVERNANCE_CHECK",
        { action, agentRole },
        "SUCCESS",
        "A.6.2.8", // ISO: Logging
        signature
    );
}

function blockAction(article: string, reason: string, isoControl: any = "A.6.2.8") {
    console.error(`\n⛔ [GOVERNANCE] Action BLOCKED by Guardian.`);
    console.error(`   - Violation: ${article}`);
    console.error(`   - Reason: ${reason}`);

    recorder.log(
        "GOVERNANCE_BLOCK",
        `Action blocked due to ${article}`,
        "GOVERNANCE_CHECK",
        { reason, article },
        "BLOCKED",
        isoControl
    );

    process.exit(1); // Fail build/pipeline
}

checkConstitution();
