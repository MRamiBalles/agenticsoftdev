
import { FlightRecorder } from '../lib/flight_recorder.ts';
import * as crypto from 'crypto';

// Parse Args
const args = process.argv.slice(2);
const action = args.find(arg => arg.startsWith('--action='))?.split('=')[1];
const comments = args.find(arg => arg.startsWith('--comments='))?.split('=')[1] || "No comments provided.";

if (!action) {
    console.error("❌ Error: --action argument is required.");
    console.log("Usage: npx ts-node scripts/governance/sign_off.ts --action=deploy_production --comments=\"Approved for release\"");
    process.exit(1);
}

// Initialize Recorder
const recorder = new FlightRecorder("HUMAN_ARCHITECT", "manual-sign-off");

async function signOff() {
    console.log(`✍️  [Human Sign-Off] Authorizing action: '${action}'...`);

    // Generate Signature
    const timestamp = new Date().toISOString();
    const payload = `${action}:${timestamp}:HUMAN_ARCHITECT`;
    const hash = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
    const signature = `SIG-HUMAN-${timestamp.replace(/[:.]/g, '')}-${hash}`;

    console.log(`\n✅ SIGNATURE GENERATED:`);
    console.log(`   ${signature}`);
    console.log(`\n   (Copy this token to authorize the Agent's action)`);

    // Log to Ledger
    recorder.log(
        "HUMAN_AUTHORIZATION",
        `Human Architect explicitly authorized critical action '${action}'.`,
        "GOVERNANCE_INTERVENTION",
        {
            action: action,
            signature: signature,
            comments: comments
        },
        "SUCCESS"
    );

    console.log(`\n📝 Event logged to Flight Recorder.`);
}

signOff();
