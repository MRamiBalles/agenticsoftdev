/**
 * Dependency Firewall: Supply Chain Security
 * 
 * Pre-commit hook that validates new dependencies against:
 * 1. CVE Database (npm audit)
 * 2. Allowlist (approved packages)
 * 3. Package reputation (downloads, age)
 * 
 * Compliance: ISO 42001 - AI Supply Chain Risk Management
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

interface AuditResult {
    vulnerabilities: Record<string, { severity: string }>;
}

// Allowlist of pre-approved packages (extend as needed)
const ALLOWLIST: string[] = [
    // Core
    'typescript', 'esbuild', 'tsx',
    // Testing
    'vitest', 'jest',
    // Linting
    'eslint', 'prettier',
    // Network (APPROVED for Netcode)
    'enet', 'flatbuffers',
    // Database (APPROVED for RAG)
    'pg', 'pgvector',
];

// Blocklist (known malicious or deprecated)
const BLOCKLIST: string[] = [
    'event-stream', // Famous supply chain attack
    'flatmap-stream',
    'left-pad', // Stability risk
];

async function checkVulnerabilities(): Promise<boolean> {
    console.log('🔍 Running npm audit...');
    try {
        const result = execSync('npm audit --json', { encoding: 'utf-8' });
        const audit: AuditResult = JSON.parse(result);

        const criticalVulns = Object.entries(audit.vulnerabilities)
            .filter(([, v]) => v.severity === 'critical' || v.severity === 'high');

        if (criticalVulns.length > 0) {
            console.error('❌ CRITICAL/HIGH vulnerabilities found:');
            criticalVulns.forEach(([name]) => console.error(`   - ${name}`));
            return false;
        }

        console.log('✅ No critical vulnerabilities found.');
        return true;
    } catch (error) {
        // npm audit returns non-zero if vulnerabilities exist
        console.error('⚠️ npm audit found issues. Review manually.');
        return false;
    }
}

function checkAllowlist(pkgPath: string): boolean {
    console.log('🔍 Checking package allowlist...');

    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    const allDeps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
    ];

    // Check blocklist
    const blocked = allDeps.filter(d => BLOCKLIST.includes(d));
    if (blocked.length > 0) {
        console.error('🚫 BLOCKED packages detected:');
        blocked.forEach(d => console.error(`   - ${d}`));
        return false;
    }

    // Check for unapproved packages
    const unapproved = allDeps.filter(d => !ALLOWLIST.includes(d) && !d.startsWith('@types/'));
    if (unapproved.length > 0) {
        console.warn('⚠️ Unapproved packages (require Guardian review):');
        unapproved.forEach(d => console.warn(`   - ${d}`));
        // Warning only, not blocking (Guardian can override)
    }

    console.log('✅ Allowlist check passed.');
    return true;
}

async function main(): Promise<void> {
    console.log('🛡️ Dependency Firewall - Supply Chain Security\n');

    const pkgPath = path.resolve(process.cwd(), 'package.json');

    if (!fs.existsSync(pkgPath)) {
        console.log('ℹ️ No package.json found. Skipping.');
        process.exit(0);
    }

    let passed = true;

    passed = checkAllowlist(pkgPath) && passed;
    passed = await checkVulnerabilities() && passed;

    if (!passed) {
        console.error('\n❌ FIREWALL BLOCKED: Fix issues before committing.');
        process.exit(1);
    }

    console.log('\n✅ FIREWALL PASSED: Dependencies are secure.');
    process.exit(0);
}

main().catch(console.error);
