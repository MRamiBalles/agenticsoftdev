
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ARCH_REPORT_PATH = path.join(process.cwd(), 'src', 'data', 'architecture_report.json');
const ORG_DEBT_REPORT_PATH = path.join(process.cwd(), 'src', 'data', 'org_debt_report.json');

// Thresholds for Defcon 1 (Immediate Action)
const MAX_CYCLES = 0;
const MAX_FRICTION = 0.8; // 80% contention
const MAX_HUBS = 2; // Tolerance for hubs before warning

interface Anomaly {
    type: 'CYCLIC_DEPENDENCY' | 'HIGH_FRICTION' | 'ARCHITECTURAL_HUB';
    severity: 'CRITICAL' | 'WARNING';
    description: string;
    culprits: string[];
}

async function runSREMonitor() {
    console.log("🚑 [SRE Agent] Starting Watchtower Scan...");
    const anomalies: Anomaly[] = [];

    // 1. Refresh Intelligence (Run Scanners)
    try {
        console.log("   - Running Architecture Scanner...");
        execSync('npx ts-node scripts/analyze_structure.ts', { stdio: 'ignore' });

        console.log("   - Running Org Debt Scanner...");
        execSync('npx ts-node scripts/analyze_org_debt.ts', { stdio: 'ignore' });
    } catch (e) {
        console.error("   ❌ Failed to run scanners. Aborting SRE check.");
        process.exit(1);
    }

    // 2. Analyze Architecture Report
    if (fs.existsSync(ARCH_REPORT_PATH)) {
        const archData = JSON.parse(fs.readFileSync(ARCH_REPORT_PATH, 'utf-8'));

        // Check for Cycles
        if (archData.circular_dependencies && archData.circular_dependencies.length > MAX_CYCLES) {
            archData.circular_dependencies.forEach((cycle: string[]) => {
                anomalies.push({
                    type: 'CYCLIC_DEPENDENCY',
                    severity: 'CRITICAL',
                    description: `Circular dependency detected: ${cycle.join(' -> ')}`,
                    culprits: cycle
                });
            });
        }

        // Check for Hubs
        if (archData.hubs && archData.hubs.length > MAX_HUBS) {
            archData.hubs.forEach((hub: any) => {
                anomalies.push({
                    type: 'ARCHITECTURAL_HUB',
                    severity: 'WARNING',
                    description: `Potential God Component detected: ${hub.id} (FanIn: ${hub.fanIn}, FanOut: ${hub.fanOut})`,
                    culprits: [hub.id]
                });
            });
        }
    }

    // 3. Analyze Org Debt Report
    if (fs.existsSync(ORG_DEBT_REPORT_PATH)) {
        const orgData = JSON.parse(fs.readFileSync(ORG_DEBT_REPORT_PATH, 'utf-8'));

        // Check for High Friction
        orgData.files.forEach((file: any) => {
            if (file.friction_score > MAX_FRICTION) {
                anomalies.push({
                    type: 'HIGH_FRICTION',
                    severity: 'CRITICAL',
                    description: `Ownership Thrashing detected in ${file.path} (Friction: ${file.friction_score})`,
                    culprits: [file.path]
                });
            }
        });
    }

    // 4. Report Status
    if (anomalies.length === 0) {
        console.log("\n✅ [SRE Agent] System Status: HEALTHY. No active incidents.");
    } else {
        console.log(`\n🚨 [SRE Agent] System Status: DEFCON ${anomalies.some(a => a.severity === 'CRITICAL') ? '1' : '3'}`);
        console.log(`   Detailed Incident Report:`);

        anomalies.forEach(anomaly => {
            const icon = anomaly.severity === 'CRITICAL' ? '🔴' : 'Vk';
            console.log(`   ${icon} [${anomaly.type}] ${anomaly.description}`);
            if (anomalies.some(a => a.severity === 'CRITICAL')) {
                console.log(`      ⚡ ACTION REQUIRED: Auto-Revert Protocol ACTIVATED.`);

                try {
                    execSync('npx ts-node scripts/ops/revert_change.ts', { stdio: 'inherit' });
                    console.log("\n✅ [SRE Agent] Threat Neutralized. System restored to safe state.");
                } catch (error) {
                    console.error("\n❌ [SRE Agent] Auto-Revert Failed. Immediate human intervention required.");
                    process.exit(1);
                }
            }

            process.exit(1); // Exit with error to signal CI failure (even if reverted, we want to notify)
        }
}

    runSREMonitor();
