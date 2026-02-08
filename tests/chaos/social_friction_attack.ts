
import * as fs from 'fs';
import * as path from 'path';

const REPORT_PATH = 'org_debt_report.json';

async function simulateSocialFriction() {
    console.log("⚔️ [Chaos] Initiating Social Friction Attack (Simulation)...");

    // Simulating a High Friction Report
    const frictionData = {
        timestamp: new Date().toISOString(),
        global_complexity: 0.95, // Critical Friction
        friction_hotspots: [
            {
                file: "src/auth/UserAuth.ts",
                authors: ["Alice (Team A)", "Bob (Team B)", "Charlie (Team A)"],
                churn_rate: 0.8,
                complexity: 15,
                friction_score: 0.9 // Very High
            },
            {
                file: "src/core/Engine.ts",
                authors: ["Dave", "Eve"],
                churn_rate: 0.6,
                complexity: 10,
                friction_score: 0.75
            }
        ],
        teams: {
            "Team A": ["Alice", "Charlie"],
            "Team B": ["Bob", "Eve"]
        }
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(frictionData, null, 2));
    console.log(`🔥 [Chaos] Social Friction injected! Fake report written to ${REPORT_PATH}`);
    console.log("   - Target: src/auth/UserAuth.ts");
    console.log("   - Simulated Authors: 3 (Rival Teams)");
}

simulateSocialFriction();
