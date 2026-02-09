
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAINS_DIR = path.join(process.cwd(), 'src', 'knowledge', 'library', 'domains');
const PROJECTS_DIR = path.join(process.cwd(), 'projects');

interface Manifest {
    rules: {
        constitution: string;
        pod_topology: string;
    };
    templates: {
        [key: string]: string;
    };
}

async function initDomain() {
    // 1. Parse Arguments
    const args = process.argv.slice(2);
    const domainArg = args.find(a => a.startsWith('--domain='));
    const nameArg = args.find(a => a.startsWith('--name='));

    if (!domainArg || !nameArg) {
        console.error("❌ Usage: npx tsx scripts/scaffold/init_domain.ts --domain=<domain_name> --name=<project_name>");
        process.exit(1);
    }

    const domainName = domainArg.split('=')[1];
    const projectName = nameArg.split('=')[1];
    const projectPath = path.join(PROJECTS_DIR, projectName);
    const domainPath = path.join(DOMAINS_DIR, domainName);

    console.log(`🚀 Initializing Project '${projectName}' with Domain '${domainName}'...`);

    // 2. Validate Domain
    if (!fs.existsSync(domainPath)) {
        console.error(`❌ Domain '${domainName}' not found in library.`);
        process.exit(1);
    }
    const manifestPath = path.join(domainPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error(`❌ Manifest not found for domain '${domainName}'.`);
        process.exit(1);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // 3. Create Project Structure
    if (fs.existsSync(projectPath)) {
        console.warn(`⚠️  Project directory '${projectName}' already exists.`);
    } else {
        fs.mkdirSync(projectPath, { recursive: true });
        console.log(`✅ Created project directory: ${projectPath}`);
    }

    // Create standard subdirectories
    ['01_specs', '02_architecture', '03_tasks', '04_src', '05_qa', '06_governance'].forEach(dir => {
        const dirPath = path.join(projectPath, dir);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
    });

    // 4. Inject Constitution (Core + Expansion)
    // Try to find core constitution in docs/governance or similar. If not found, use empty string.
    let coreConstitution = "";
    const possibleCorePaths = [
        path.join(process.cwd(), 'src', 'knowledge', 'library', 'core', 'base_constitution.md'),
        path.join(process.cwd(), 'docs', 'governance', 'constitution.md'),
        path.join(process.cwd(), 'CONSTITUTION.md')
    ];

    for (const p of possibleCorePaths) {
        if (fs.existsSync(p)) {
            coreConstitution = fs.readFileSync(p, 'utf-8');
            console.log(`ℹ️  Loaded Core Constitution from ${p}`);
            break;
        }
    }

    const expansionPath = path.join(domainPath, manifest.rules.constitution);
    let expansionText = "";
    if (fs.existsSync(expansionPath)) {
        expansionText = fs.readFileSync(expansionPath, 'utf-8');
    }

    const fusedConstitution = `${coreConstitution}\n\n---\n\n${expansionText}`;
    fs.writeFileSync(path.join(projectPath, '06_governance', 'constitution.md'), fusedConstitution);
    console.log(`✅ Generated Fused Constitution in 06_governance/constitution.md`);

    // 5. Inject Templates
    if (manifest.templates.spec) {
        const src = path.join(domainPath, manifest.templates.spec);
        const dest = path.join(projectPath, '01_specs', 'spec.md');
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`✅ Injected Spec Template`);
        }
    }
    if (manifest.templates.plan) {
        const src = path.join(domainPath, manifest.templates.plan);
        const dest = path.join(projectPath, '02_architecture', 'plan.md');
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`✅ Injected Plan Template`);
        }
    }

    // 6. Inject Pod Topology (Agent Roles)
    const topoPath = path.join(domainPath, manifest.rules.pod_topology);
    if (fs.existsSync(topoPath)) {
        fs.copyFileSync(topoPath, path.join(projectPath, '06_governance', 'pod_topology.json'));
        console.log(`✅ Injected Pod Topology`);
    }

    console.log(`\n🎉 Project '${projectName}' initialized successfully with '${domainName}' cartridge!`);
    console.log(`👉 Next steps:`);
    console.log(`   cd projects/${projectName}`);
    console.log(`   Edit 01_specs/spec.md to define your game.`);
}

initDomain();
