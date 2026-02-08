
import * as fs from 'fs';
import * as path from 'path';
import { ESLint } from 'eslint';

// SECURITY THRESHOLDS
const CRITICAL_PENALTY = 500;

interface SecurityViolation {
    file: string;
    line: number;
    type: 'SECRET' | 'INJECTION' | 'VULNERABILITY';
    message: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface SecurityReport {
    timestamp: string;
    violations: SecurityViolation[];
    total_penalty: number;
}

// 1. REGEX HEURISTICS (Secrets)
const SECRET_PATTERNS = [
    { name: 'OpenAI Chain Key', regex: /sk-[a-zA-Z0-9]{32,}/ },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
    { name: 'Private Key Block', regex: /-----BEGIN PRIVATE KEY-----/ },
    { name: 'Generic API Key', regex: /api_key\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/ },
    { name: 'JWT Token', regex: /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/ }
];

async function scanSecrets(filePath: string, content: string): Promise<SecurityViolation[]> {
    const violations: SecurityViolation[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        for (const pattern of SECRET_PATTERNS) {
            if (pattern.regex.test(line)) {
                // REDACTED OUTPUT FOR UI
                violations.push({
                    file: filePath,
                    line: index + 1,
                    type: 'SECRET',
                    message: `Potential ${pattern.name} exposed (Redacted)`,
                    severity: 'CRITICAL'
                });
            }
        }
    });
    return violations;
}

// 2. ESLINT ANALYSIS (Code Patterns)
async function scanCodePatterns(filePaths: string[]): Promise<SecurityViolation[]> {
    const eslint = new ESLint({
        useEslintrc: false,
        overrideConfig: {
            parser: '@typescript-eslint/parser',
            plugins: ['security'],
            extends: ['plugin:security/recommended'],
            rules: {
                'security/detect-eval-with-expression': 'error',
                'security/detect-child-process': 'warn',
                'security/detect-object-injection': 'warn'
            }
        }
    });

    const results = await eslint.lintFiles(filePaths);
    const violations: SecurityViolation[] = [];

    results.forEach(result => {
        result.messages.forEach(msg => {
            violations.push({
                file: path.relative(process.cwd(), result.filePath),
                line: msg.line,
                type: 'INJECTION',
                message: msg.message,
                severity: msg.severity === 2 ? 'HIGH' : 'MEDIUM'
            });
        });
    });

    return violations;
}

async function analyzeSecurity() {
    console.log("🛡️  Starting Security Shield Scan...");

    // Find files
    const srcDir = path.join(process.cwd(), 'src');

    // Recursive file walker (simple version)
    function getAllFiles(dir: string, fileList: string[] = []) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                getAllFiles(filePath, fileList);
            } else {
                if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                    fileList.push(filePath);
                }
            }
        });
        return fileList;
    }

    const files = getAllFiles(srcDir);
    let allViolations: SecurityViolation[] = [];

    // Run Scans
    for (const file of files) {
        const relativePath = path.relative(process.cwd(), file);
        const content = fs.readFileSync(file, 'utf-8');

        // 1. Secrets
        const secretViolations = await scanSecrets(relativePath, content);
        allViolations = [...allViolations, ...secretViolations];
    }

    // 2. ESLint
    // const usageViolations = await scanCodePatterns(files); // Commented out until @typescript-eslint/parser is available or configured
    // allViolations = [...allViolations, ...usageViolations];

    // Calculate Penalty
    let totalPenalty = 0;
    allViolations.forEach(v => {
        if (v.severity === 'CRITICAL') totalPenalty += CRITICAL_PENALTY;
        if (v.severity === 'HIGH') totalPenalty += 100;
        if (v.severity === 'MEDIUM') totalPenalty += 50;
    });

    // Output Report
    const report: SecurityReport = {
        timestamp: new Date().toISOString(),
        violations: allViolations,
        total_penalty: totalPenalty
    };

    const reportPath = path.join(process.cwd(), ".ai", "atdi_security_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`🛡️  Scan Complete.`);
    console.log(`Violations Found: ${allViolations.length}`);
    console.log(`Security Debt Penalty: +${totalPenalty} ATDI`);

    if (totalPenalty > 0) {
        console.error("❌ SECURITY ALERT: Vulnerabilities detected.");
        process.exit(1);
    } else {
        console.log("✅ Security Clean.");
    }
}

analyzeSecurity();
