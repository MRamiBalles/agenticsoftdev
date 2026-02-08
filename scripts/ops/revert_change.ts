
import simpleGit from 'simple-git';
import { FlightRecorder } from '../lib/flight_recorder';

const git = simpleGit();
const recorder = new FlightRecorder("SovereignSRE-01", "auto-revert-session");

async function revertLastCommit() {
    console.log("🛡️ [Auto-Revert] Initiating Defensive Protocol...");

    try {
        // 1. Check if working directory is clean
        const status = await git.status();
        if (!status.isClean()) {
            console.error("❌ [Auto-Revert] Working directory is not clean. Aborting revert to prevent data loss.");
            recorder.log("SYSTEM_SELF_HEALING", "Aborted revert due to dirty working directory", "GOVERNANCE_INTERVENTION", { reason: "Dirty WD" }, "BLOCKED");
            process.exit(1);
        }

        // 2. Get Last Commit Info for Log
        const log = await git.log({ maxCount: 1 });
        const lastCommit = log.latest;

        if (!lastCommit) {
            console.error("❌ [Auto-Revert] No commits to revert.");
            process.exit(1);
        }

        console.log(`   - Target Commit: ${lastCommit.hash} by ${lastCommit.author_name}`);
        console.log(`   - Message: ${lastCommit.message}`);

        // 3. Execute Revert
        // --no-edit to accept default revert message
        await git.revert(lastCommit.hash, { '--no-edit': null });

        console.log("✅ [Auto-Revert] Revert Successful.");

        // 4. Log to Flight Recorder
        recorder.log(
            "CRITICAL_ANOMALY_DETECTED",
            `Reverted commit ${lastCommit.hash} due to detected architectural/governance violation.`,
            "GOVERNANCE_INTERVENTION",
            {
                reverted_commit: lastCommit.hash,
                reverted_author: lastCommit.author_name,
                action: "git revert HEAD"
            },
            "SUCCESS"
        );

    } catch (e: any) {
        console.error("❌ [Auto-Revert] Failed to revert:", e);
        recorder.log("SYSTEM_SELF_HEALING", "Revert failed execution", "GOVERNANCE_INTERVENTION", { error: e.message }, "FAILURE");
        process.exit(1);
    }
}

revertLastCommit();
