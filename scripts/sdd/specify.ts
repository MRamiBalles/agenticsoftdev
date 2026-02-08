
import * as fs from 'fs';
import * as path from 'path';

async function specify() {
    console.log("📝 [Specify Agent] Initializing Requirements Capture...");

    const args = process.argv.slice(2);
    const featureName = args[0] || 'NewFeature';
    const specPath = path.join(process.cwd(), 'docs', 'specs', `${featureName.toLowerCase().replace(/\s+/g, '_')}.md`);

    if (!fs.existsSync(path.dirname(specPath))) {
        fs.mkdirSync(path.dirname(specPath), { recursive: true });
    }

    const initialTemplate = `
# Specification: ${featureName}

## Overview
[Draft: Capture the core intent here]

## User Value
- [ ] Benefit 1
- [ ] Benefit 2

## Functional Requirements
1. [ ] Requirement A
2. [ ] Requirement B

## Technical Constraints
- [ ] Constraint 1

## Out of Scope
- [ ] Item 1
`;

    fs.writeFileSync(specPath, initialTemplate);
    console.log(`\n✅ [SDD] Specification draft created: ${specPath}`);
    console.log(`\n👉 NEXT STEP: Edit the specification file to reflect your requirements, then run:`);
    console.log(`   npx tsx scripts/sdd/plan.ts ${featureName}`);
}

specify();
