
import * as fs from 'fs';
import * as path from 'path';

async function plan() {
    const args = process.argv.slice(2);
    const featureName = args[0] || 'NewFeature';
    const featureId = featureName.toLowerCase().replace(/\s+/g, '_');

    const specPath = path.join(process.cwd(), 'docs', 'specs', `${featureId}.md`);
    const planPath = path.join(process.cwd(), 'docs', 'plans', `${featureId}.md`);

    if (!fs.existsSync(specPath)) {
        console.error(`❌ Error: Specification NOT FOUND at ${specPath}`);
        process.exit(1);
    }

    console.log(`🏗️  [Plan Agent] Drafting Architecture Plan for '${featureName}'...`);

    const specContent = fs.readFileSync(specPath, 'utf-8');

    const planTemplate = `
# Architecture Plan: ${featureName}

## Design Decisions
- [ ] Decision 1: [Context]

## File Changes
- [NEW] [ComponentName](file:///src/components/${featureId}/...)
- [MODIFY] [Index](file:///src/pages/Index.tsx)

## Verification Strategy
- [ ] Task 1: [Test Case]
`;

    if (!fs.existsSync(path.dirname(planPath))) {
        fs.mkdirSync(path.dirname(planPath), { recursive: true });
    }

    fs.writeFileSync(planPath, planTemplate);
    console.log(`\n✅ [SDD] Architecture plan drafted: ${planPath}`);
    console.log(`\n👉 NEXT STEP: Review the plan, then run:`);
    console.log(`   npx tsx scripts/sdd/taskify.ts ${featureName}`);
}

plan();
