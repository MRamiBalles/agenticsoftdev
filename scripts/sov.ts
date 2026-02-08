
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const COMMANDS = {
    'status': 'npx tsx scripts/utils/heartbeat.ts',
    'doctor': 'npx tsx scripts/utils/health_check.ts',
    'purge': 'npx tsx scripts/value/analyze_atrophy.ts --purge',
    'audit': 'npx tsx scripts/socio/agent_audit.ts'
};

function runSov() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === 'help') {
        console.log(`
🦅 Sovereign SDLC CLI (v4.1)
Usage: sov <command>

Commands:
  status    Run System Nervous System heartbeat (Vitals).
  doctor    Run full health diagnostic (Tests + Arch).
  purge     Execute Atrophy Protocol (Delete dead code).
  audit     Run MAD-BAD-SAD ethical audit.
  help      Show this message.
`);
        return;
    }

    const cmdStr = COMMANDS[command as keyof typeof COMMANDS];
    if (!cmdStr) {
        console.error(`❌ Unknown command: '${command}'. Try 'sov help'.`);
        process.exit(1);
    }

    try {
        console.log(`🦅 Executing Sovereign Protocol: [${command}]...`);
        execSync(cmdStr, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Protocol Failed.`);
        process.exit(1);
    }
}

runSov();
