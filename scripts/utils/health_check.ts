
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Configuration
const REPORTS = {
    atrophy: 'atrophy_report.json',
    orgDebt: 'org_debt_report.json',
    architecture: 'src/data/architecture_report.json'
};

const HTML_REPORT_PATH = 'docs/reports/health_status.html';

async function runHealthCheck() {
    console.log("🩺 [Health Check] Starting System Diagnosis...");

    // 1. Run Scanners
    try {
        console.log("   - Scanning for Atrophy...");
        execSync('npx tsx scripts/value/analyze_atrophy.ts', { stdio: 'ignore' });

        console.log("   - Scanning for Org Debt...");
        execSync('npx tsx scripts/analyze_org_debt.ts', { stdio: 'ignore' });

        console.log("   - Scanning Architecture...");
        execSync('npx tsx scripts/analyze_structure.ts', { stdio: 'ignore' });
    } catch (e) {
        console.warn("   ⚠️  Warning: Some scanners failed to run. Proceeding with available reports.");
    }

    // 2. Read Reports
    const data = {
        atrophy: readJson(REPORTS.atrophy),
        orgDebt: readJson(REPORTS.orgDebt),
        architecture: readJson(REPORTS.architecture)
    };

    // 3. Generate HTML
    const html = generateHtml(data);

    // 4. Save
    const reportDir = path.dirname(HTML_REPORT_PATH);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(HTML_REPORT_PATH, html);

    console.log(`\n✅ [Health Check] Report generated at: ${HTML_REPORT_PATH}`);

    // 5. Console Summary
    printSummary(data);
}

function readJson(filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) { return null; }
    return null;
}

function generateHtml(data: any): string {
    const timestamp = new Date().toISOString();

    let status = "HEALTHY";
    if (data.atrophy?.candidates?.length > 10) status = "WARNING";
    if (data.architecture?.circular_dependencies?.length > 0) status = "CRITICAL";

    const color = status === "HEALTHY" ? "green" : (status === "WARNING" ? "orange" : "red");

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Sovereign System Health</title>
        <style>
            body { font-family: sans-serif; padding: 20px; background: #1a1a1a; color: #eee; }
            .card { background: #333; padding: 20px; margin: 10px 0; border-radius: 8px; }
            .status { font-weight: bold; color: ${color}; }
            h1, h2 { border-bottom: 1px solid #555; padding-bottom: 10px; }
            .metric { font-size: 1.2em; }
        </style>
    </head>
    <body>
        <h1>🏥 System Health Status: <span class="status">${status}</span></h1>
        <p>Generated: ${timestamp}</p>

        <div class="card">
            <h2>📉 Digital Atrophy</h2>
            <div class="metric">Zombie Files: ${data.atrophy?.candidates?.length || 0}</div>
            <p>Files in Purgatory: ${data.atrophy?.purgatory?.length || 0}</p>
        </div>

        <div class="card">
            <h2>👥 Organizational Debt</h2>
            <div class="metric">Friction Hotspots: ${data.orgDebt?.friction_hotspots?.length || 0}</div>
            <p>Social Complexity: ${data.orgDebt?.global_complexity || 'N/A'}</p>
        </div>

        <div class="card">
            <h2>🏗️ Architecture</h2>
            <div class="metric">Circular Dependencies: ${data.architecture?.circular_dependencies?.length || 0}</div>
            <div class="metric">God Components: ${data.architecture?.god_components?.length || 0}</div>
            <div class="metric">Hubs: ${data.architecture?.hubs?.length || 0}</div>
        </div>
    </body>
    </html>
    `;
}

function printSummary(data: any) {
    console.log("\n--- DIAGNOSTIC SUMMARY ---");
    console.log(`💀 Atrophy Candidates: ${data.atrophy?.candidates?.length || 0}`);
    console.log(`🔥 Friction Hotspots:  ${data.orgDebt?.friction_hotspots?.length || 0}`);
    console.log(`⭕ Cycles Detected:    ${data.architecture?.circular_dependencies?.length || 0}`);
    console.log(`🕷️ Hubs Detected:      ${data.architecture?.hubs?.length || 0}`);
}

runHealthCheck();
