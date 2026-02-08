
import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIR = 'src/legacy/hub_test';

async function injectHub() {
    console.log("🕸️ [Chaos] Creating Architectural Hub (God Object)...");

    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    // 1. Create the God Object
    const godPath = path.join(TARGET_DIR, 'GodObject.ts');
    let godContent = `export class GodObject {\n`;
    for (let i = 0; i < 20; i++) {
        godContent += `    public static method${i}() { return ${i}; }\n`;
    }
    godContent += `}\n`;
    fs.writeFileSync(godPath, godContent);
    console.log(`   - Created GodObject: ${godPath}`);

    // 2. Create 20 Satellites that depend on it
    for (let i = 0; i < 20; i++) {
        const satPath = path.join(TARGET_DIR, `Satellite${i}.ts`);
        const content = `
import { GodObject } from './GodObject';

export class Satellite${i} {
    public doWork() {
        // High coupling to the Hub
        GodObject.method${i}();
    }
}
        `;
        fs.writeFileSync(satPath, content);
    }

    console.log(`🕷️ [Chaos] Hub-like dependency structure created with 20 satellites.`);
}

injectHub();
