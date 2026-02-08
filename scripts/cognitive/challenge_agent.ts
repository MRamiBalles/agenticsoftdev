
import * as fs from 'fs';
import * as path from 'path';

// "Weak Words" that indicate ambiguous thinking
const WEAK_WORDS = [
    'basically', 'hopefully', 'should work', 'pretty much', 'fast', 'secure', 'optimize', 'refactor'
];

// Required Sections for a Sovereign Spec/Plan
const REQUIRED_SECTIONS = [
    'Context', 'Risk', 'Security', 'Testing', 'Rollback'
];

function challengeDocument() {
    const targetFile = process.argv[2];

    if (!targetFile) {
        console.error("❌ Usage: npx tsx scripts/cognitive/challenge_agent.ts <path/to/spec.md>");
        process.exit(1);
    }

    if (!fs.existsSync(targetFile)) {
        console.error(`❌ File not found: ${targetFile}`);
        process.exit(1);
    }

    console.log(`😈 [Challenge Agent] Analyzing '${targetFile}' for weakness...`);
    const content = fs.readFileSync(targetFile, 'utf-8');
    const lines = content.split('\n');
    let score = 100;
    const issues: string[] = [];

    // 1. Ambiguity Check (Weak Words)
    let weakWordCount = 0;
    WEAK_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
            weakWordCount += matches.length;
            issues.push(`⚠️  Ambiguity: Found weak word '${word}' ${matches.length} time(s). Be specific.`);
            score -= (matches.length * 2);
        }
    });

    // 2. Structural Integrity (Required Sections)
    REQUIRED_SECTIONS.forEach(section => {
        const regex = new RegExp(`^#+.*${section}`, 'im');
        if (!regex.test(content)) {
            issues.push(`⛔  Missing Structure: No '${section}' section found.`);
            score -= 15;
        }
    });

    // 3. Constitutional Check (Heuristics)
    // Check for "God Mode" risks
    if (content.toLowerCase().includes('sudo') || content.toLowerCase().includes('force')) {
        issues.push(`🚨  Constitutional Risk: Detected 'force/sudo' language. Violates Article IV (Safety).`);
        score -= 20;
    }

    // Check for Vague "Optimization" without metrics
    if (content.toLowerCase().includes('optimize') && !content.includes('%') && !content.includes('ms')) {
        issues.push(`📉  Unquantified Optimization: You promised to 'optimize' but provided no metrics (ms/KB).`);
        score -= 10;
    }

    // Report
    console.log("\n--- 📝 CRITIQUE REPORT ---");
    if (issues.length === 0) {
        console.log("✅ No obvious flaws detected. You survived the Devil's Advocate.");
    } else {
        issues.forEach(issue => console.log(issue));
    }

    console.log(`\n🏆 Quality Score: ${score}/100`);

    if (score < 70) {
        console.log("\n❌ VERDICT: REJECTED. Fix the issues above before proceeding.");
        process.exit(1);
    } else {
        console.log("\n✅ VERDICT: PASSED (with caveats).");
    }
}

challengeDocument();
