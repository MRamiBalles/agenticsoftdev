
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const COMMANDS = [
    { name: "ATDI Analysis", cmd: "npx tsx scripts/analyze_structure.ts" }, // Architecture
    { name: "Conway Radar", cmd: "npx tsx scripts/socio/conway_radar.ts" }, // Socio-Technical
    { name: "Atrophy Scan", cmd: "npx tsx scripts/value/analyze_atrophy.ts" } // Value
];

function triggerHeartbeat() {
    console.log("💓 [Heartbeat] System Vital Signs Update Initiated...");
    const results: { name: string; status: 'OK' | 'FAIL'; duration: number }[] = [];

    COMMANDS.forEach(task => {
        const start = Date.now();
        try {
            console.log(`   👉 Running: ${task.name}...`);
            execSync(task.cmd, { stdio: 'inherit' }); // Inheritance allows logs to show
            results.push({ name: task.name, status: 'OK', duration: Date.now() - start });
        } catch (e) {
            console.error(`   ❌ Failed: ${task.name}`);
            results.push({ name: task.name, status: 'FAIL', duration: Date.now() - start });
        }
    });

    console.log("\n📈 [Heartbeat] Pulse Report:");
    console.table(results);

    // Log to Flight Recorder if available
    try {
        // Optional: Call recorder
    } catch (e) { }
}

triggerHeartbeat();
