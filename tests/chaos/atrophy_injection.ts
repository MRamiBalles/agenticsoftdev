
import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIR = 'src/legacy/garbage';

async function injectAtrophy() {
    console.log("🧟 [Chaos] Injecting Digital Atrophy...");

    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    // Generate 50 useless files
    for (let i = 0; i < 50; i++) {
        const fileName = `ZombieUtils${i}.ts`;
        const filePath = path.join(TARGET_DIR, fileName);

        const content = `
export class ZombieUtils${i} {
    // This class does nothing but consume disk space and cognitive load
    public static uselessMethod${i}(): void {
        console.log("Brain...s...");
        const a = ${i} + 1;
        const b = a * 2;
    }
    
    // Legacy code from 1999
    private unusedProperty: string = "deprecated";
}
        `;

        fs.writeFileSync(filePath, content);
    }

    console.log(`⚰️ [Chaos] Successfully injected 50 Zombie Files into ${TARGET_DIR}`);
}

injectAtrophy();
