
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const FILES_TO_SEAL = [
    '.specify/memory/constitution.md',
    'scripts/governance/check_constitution.ts',
    'scripts/governance/sign_off.ts',
    'scripts/governance/chief_of_staff.ts',
    'docs/architecture/roadmap.md',
    'docs/ops/sovereign_handbook.md'
];

const MANIFESTO_PATH = path.join(process.cwd(), 'docs', 'governance', 'sovereignty_manifesto.md');

function getHash(filePath: string): string {
    const content = fs.readFileSync(path.join(process.cwd(), filePath));
    return crypto.createHash('sha256').update(content).digest('hex');
}

async function sealManifesto() {
    console.log("📜 [Golden Seal] Sealing the Sovereignty Manifesto...");

    const timestamp = new Date().toISOString();
    let manifesto = `# Sovereignty Manifesto: v3.0-GOLD 🏛️\n\n`;
    manifesto += `**Date of Seal**: ${timestamp}\n`;
    manifesto += `**Status**: SEALED & IMMUTABLE\n\n`;
    manifesto += `## 🔒 Cryptographic Hashes (SHA-256)\n`;
    manifesto += `| File Path | Hash |\n`;
    manifesto += `|-----------|------|\n`;

    FILES_TO_SEAL.forEach(file => {
        try {
            const hash = getHash(file);
            manifesto += `| \`${file}\` | \`${hash}\` |\n`;
        } catch (e) {
            console.warn(`   ⚠️  Warning: File not found: ${file}`);
        }
    });

    manifesto += `\n## 🏁 Final Affirmation\n`;
    manifesto += `I, the Chief of Staff Agent, hereby certify that this snapshot represents the Sovereign State of the Platform at the moment of completion. No code shall advance without a human signature passing the Constitutional Gate.\n\n`;
    manifesto += `***\n`;
    manifesto += `*Signed by the Executive Layer - 2026*`;

    if (!fs.existsSync(path.dirname(MANIFESTO_PATH))) {
        fs.mkdirSync(path.dirname(MANIFESTO_PATH), { recursive: true });
    }

    fs.writeFileSync(MANIFESTO_PATH, manifesto);
    console.log(`\n✅ [GOLD] Manifesto sealed at: ${MANIFESTO_PATH}`);
}

sealManifesto();
