
import { FlightRecorder } from './lib/flight_recorder';

async function verifyGovernance() {
    console.log("🛡️ Starting Governance Auto-Block Verification...");
    const recorder = new FlightRecorder("ArchitectAgent-Verify", "session-block-01");

    const contestedFile = "src/components/governance/RaciCard.tsx";
    const safeFile = "src/pages/MissionControl.tsx";

    // Test 1: Safe File
    console.log(`\n[TEST 1] Attempting to edit SAFE file: ${safeFile}`);
    try {
        await recorder.interceptToolExecution('replace_file_content', { path: safeFile });
        console.log("✅ ALLOWED (Expected).");
    } catch (e) {
        console.error("❌ FAILED: Safe file was blocked.", e);
    }

    // Test 2: Contested File
    console.log(`\n[TEST 2] Attempting to edit CONTESTED file: ${contestedFile}`);
    try {
        await recorder.interceptToolExecution('replace_file_content', { path: contestedFile });
        console.error("❌ FAILED: Contested file was ALLOWED (Should be BLOCKED).");
    } catch (e: any) {
        console.log("✅ BLOCKED (Expected).");
        console.log(`   Reason: ${e.message}`);
    }
}

verifyGovernance();
