
import * as fs from 'fs';
import * as path from 'path';

// CONFIGURATION
const PLAN_FILE = 'docs/architecture/plan_mission_control.md'; // Default target, should be dynamic
const CONSTITUTION_FILE = 'constitution.md';

interface AuditResult {
    check: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
}

function auditPlan() {
    console.log(`⚖️  Plan Validator Agent (The Auditor) initialized.`);
    console.log(`📜  Reading: ${PLAN_FILE}`);

    if (!fs.existsSync(PLAN_FILE)) {
        console.error(`❌ CRITICAL: Plan file not found: ${PLAN_FILE}`);
        process.exit(1);
    }

    const planContent = fs.readFileSync(PLAN_FILE, 'utf-8');
    const results: AuditResult[] = [];

    // 1. Structural Integrity
    // -----------------------
    // Check for TBDs
    if (planContent.includes('TBD') || planContent.includes('[ ]')) {
        results.push({ check: 'Completeness', status: 'FAIL', message: 'Plan contains TBDs or empty checkboxes.' });
    } else {
        results.push({ check: 'Completeness', status: 'PASS', message: 'No incomplete sections detected.' });
    }

    // 2. Iron Rules (Keywords)
    // ------------------------
    const prohibited = ['jQuery', 'Bootstrap', 'Angular', 'PHP', 'class component'];
    const failures = prohibited.filter(word => planContent.toLowerCase().includes(word.toLowerCase()));

    if (failures.length > 0) {
        results.push({ check: 'Stack Sovereignty', status: 'FAIL', message: `Prohibited tech detected: ${failures.join(', ')}` });
    } else {
        results.push({ check: 'Stack Sovereignty', status: 'PASS', message: 'Stack adheres to Constitution.' });
    }

    // 3. Mandatory Sections
    // ---------------------
    const requiredSections = ['## Proposed Changes', '## Verification Plan', '## User Review'];
    const missingSections = requiredSections.filter(sec => !planContent.includes(sec));

    if (missingSections.length > 0) {
        results.push({ check: 'Required Sections', status: 'FAIL', message: `Missing sections: ${missingSections.join(', ')}` });
    } else {
        results.push({ check: 'Required Sections', status: 'PASS', message: 'All mandatory sections present.' });
    }

    // 4. Governance Checks
    // --------------------
    // Check for testing mentions
    if (!planContent.toLowerCase().includes('test') && !planContent.toLowerCase().includes('verify')) {
        results.push({ check: 'Quality Assurance', status: 'WARN', message: 'No explicit testing strategy mentioned.' });
    } else {
        results.push({ check: 'Quality Assurance', status: 'PASS', message: 'Verification strategy found.' });
    }

    // FINAL VERDICT
    console.table(results);

    const failuresCount = results.filter(r => r.status === 'FAIL').length;
    if (failuresCount > 0) {
        console.error(`\n🚫 PLAN REJECTED: ${failuresCount} critical violations found.`);
        process.exit(1);
    } else {
        console.log(`\n✅ PLAN APPROVED: Ready for Task Decomposition.`);
        // In a real agentic loop, this would trigger the Task Agent
    }
}

auditPlan();
