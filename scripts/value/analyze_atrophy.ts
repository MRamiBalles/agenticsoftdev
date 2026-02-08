
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const THRESHOLD_MONTHS = 6;
const KTLO_CRITICAL_RATIO = 0.7; // 70% of effort is maintenance

interface AtrophyCandidate {
    path: string;
    ktlo_ratio: number;
    last_modified: string;
    reason: string;
    severity: 'HIGH' | 'MEDIUM';
}

async function analyzeAtrophy() {
    console.log("✂️ [Value Aligner] Starting Digital Atrophy Scan...");
    const candidates: AtrophyCandidate[] = [];

    // 1. Analyze Git History for KTLO (Keep The Lights On)
    // We'll use git log to count 'fix/chore' vs 'feat' keywords in commit messages per file
    try {
        console.log("   - Analyzing effort distribution (KTLO vs Value)...");
        const files = execSync('git ls-files src', { encoding: 'utf-8' }).split('\n').filter(Boolean);

        for (const file of files) {
            const logs = execSync(`git log --pretty=format:"%s" -- "${file}"`, { encoding: 'utf-8' }).split('\n');
            if (logs.length < 3) continue; // Skip very new files

            let maintenanceCount = 0;
            let valueCount = 0;

            logs.forEach(msg => {
                const lower = msg.toLowerCase();
                if (lower.includes('fix') || lower.includes('chore') || lower.includes('refactor') || lower.includes('debug')) {
                    maintenanceCount++;
                } else if (lower.includes('feat') || lower.includes('feature') || lower.includes('add') || lower.includes('implement')) {
                    valueCount++;
                }
            });

            const total = maintenanceCount + valueCount;
            const ktloRatio = total > 0 ? maintenanceCount / total : 0;
            const lastDate = execSync(`git log -1 --format=%ai -- "${file}"`, { encoding: 'utf-8' }).trim();
            const lastModDate = new Date(lastDate);
            const monthsSinceMod = (new Date().getTime() - lastModDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

            // Logic: High KTLO or long inactivity
            if (ktloRatio > KTLO_CRITICAL_RATIO && logs.length > 5) {
                candidates.push({
                    path: file,
                    ktlo_ratio: parseFloat(ktloRatio.toFixed(2)),
                    last_modified: lastDate,
                    reason: `High Maintenance Effort (${(ktloRatio * 100).toFixed(0)}% KTLO)`,
                    severity: 'HIGH'
                });
            } else if (monthsSinceMod > THRESHOLD_MONTHS) {
                candidates.push({
                    path: file,
                    ktlo_ratio: parseFloat(ktloRatio.toFixed(2)),
                    last_modified: lastDate,
                    reason: `Long-term Inactivity (> ${THRESHOLD_MONTHS} months)`,
                    severity: 'MEDIUM'
                });
            }
        }
    } catch (e) {
        console.error("   ❌ Failed to analyze git history.");
    }

    // 2. Output Report
    const reportPath = path.join(process.cwd(), 'src', 'data', 'atrophy_report.json');
    const report = {
        scan_date: new Date().toISOString(),
        atrophy_level: candidates.length > 10 ? 'HIGH' : 'LOW',
        candidates: candidates.sort((a, b) => b.ktlo_ratio - a.ktlo_ratio)
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📉 [VALUE] Atrophy Scan Complete.`);
    console.log(`   - Candidates for Purgatory: ${candidates.length}`);
    console.log(`   - Report generated at: src/data/atrophy_report.json`);

    if (candidates.length > 0) {
        console.log(`\n⚠️  TOP RECOMMENDATIONS FOR REMOVAL:`);
        candidates.slice(0, 3).forEach(c => {
            console.log(`   - [${c.severity}] ${c.path}: ${c.reason}`);
        });
    }
}

analyzeAtrophy();
