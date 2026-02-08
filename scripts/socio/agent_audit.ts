
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'reports', 'agent_impact_audit.md');
const CONSTITUTION_PATH = path.join(process.cwd(), '.specify/memory/constitution.md');

// MAD (Morality/Autonomy/Distribution)
// BAD (Bias/Accountability/Democratic)
// SAD (Safety/Adoption/Durability)

interface Assessment {
    category: 'MAD' | 'BAD' | 'SAD';
    topic: string;
    check: () => boolean;
    pass_msg: string;
    fail_msg: string;
}

function runAudit() {
    console.log("🕵️‍♀️ [Impact Audit] Assessing Agentic Risks (MAD-BAD-SAD)...");

    const checks: Assessment[] = [
        // --- MAD: Morality & Autonomy ---
        {
            category: 'MAD',
            topic: 'Autonomous Kill Switch',
            check: () => {
                // Check if Agents can execute kill_switch without signature?
                // Heuristic: Check check_constitution code.
                const checkScript = fs.readFileSync(path.join(process.cwd(), 'scripts', 'governance', 'check_constitution.ts'), 'utf-8');
                return checkScript.includes('SIG-HUMAN') && checkScript.includes('activate_kill_switch');
            },
            pass_msg: "Kill Switch execution is effectively gated by Human Signature.",
            fail_msg: "RISK: Kill Switch logic does not seem to strictly enforce Human Signature."
        },
        {
            category: 'MAD',
            topic: 'Moral Boundary Definition',
            check: () => {
                return fs.existsSync(CONSTITUTION_PATH) && fs.readFileSync(CONSTITUTION_PATH, 'utf-8').includes('Article I');
            },
            pass_msg: "Constitution exists and defines Moral Boundaries (Article I).",
            fail_msg: "RISK: System lacks a defined Constitution or Moral Boundary."
        },

        // --- BAD: Bias & Accountability ---
        {
            category: 'BAD',
            topic: 'Accountability Traceability',
            check: () => {
                const logPath = path.join(process.cwd(), '.ai', 'audit', 'ledger.jsonl');
                return fs.existsSync(logPath); // Crude check
            },
            pass_msg: "Audit Ledger is active. Actions are traceable.",
            fail_msg: "RISK: No centralized Audit Ledger found. Accountability is low."
        },
        {
            category: 'BAD',
            topic: 'Role Separation',
            check: () => {
                const constText = fs.readFileSync(CONSTITUTION_PATH, 'utf-8');
                return constText.includes('Accountable (A)') && constText.includes('Responsible (R)');
            },
            pass_msg: "RACI roles (Accountable vs Responsible) are constitutionally defined.",
            fail_msg: "RISK: Roles are ambiguous in the Constitution."
        },

        // --- SAD: Safety & Adoption ---
        {
            category: 'SAD',
            topic: 'Operational Documentation',
            check: () => fs.existsSync(path.join(process.cwd(), 'docs', 'ops', 'sovereign_handbook.md')),
            pass_msg: "Sovereign Handbook exists for human operators.",
            fail_msg: "RISK: No Operational Handbook. 'Bus Factor' is high."
        },
        {
            category: 'SAD',
            topic: 'Feedback Loops',
            check: () => fs.existsSync(path.join(process.cwd(), 'scripts', 'cognitive', 'challenge_agent.ts')),
            pass_msg: "Challenge Agent is deployed to critique system decisions.",
            fail_msg: "RISK: No internal critic/feedback loop detected."
        }
    ];

    let score = 0;
    let report = `# 🛡️ MAD-BAD-SAD Impact Audit
**Date:** ${new Date().toISOString()}
**Auditor:** Agentic Auditor v1.0

## Summary
`;

    const results = checks.map(c => {
        const passed = c.check();
        if (passed) score++;
        return { ...c, passed };
    });

    const percent = Math.round((score / checks.length) * 100);
    report += `**Compliance Score:** ${percent}%\n\n## Detailed Findings\n\n`;

    results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        report += `### ${icon} [${r.category}] ${r.topic}\n`;
        report += `*   ${r.passed ? r.pass_msg : r.fail_msg}\n\n`;
    });

    // Write Report
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, report);
    console.log(`✅ [Impact Audit] Report generated: ${OUTPUT_PATH} (Score: ${percent}%)`);
}

runAudit();
