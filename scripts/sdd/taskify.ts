
import * as fs from 'fs';
import * as path from 'path';

async function taskify() {
    const args = process.argv.slice(2);
    const featureName = args[0] || 'NewFeature';
    const featureId = featureName.toLowerCase().replace(/\s+/g, '_');

    const planPath = path.join(process.cwd(), 'docs', 'plans', `${featureId}.md`);
    const taskMdPath = path.join(process.cwd(), '.gemini', 'antigravity', 'brain', '229b14ba-d9a8-49bc-b3c0-dfd58ac6d52c', 'task.md');

    if (!fs.existsSync(planPath)) {
        console.error(`❌ Error: Plan NOT FOUND at ${planPath}`);
        process.exit(1);
    }

    console.log(`🔨 [Taskify Agent] Deconstructing Plan for '${featureName}' into task.md...`);

    // In a real scenario, this would parse the plan.md markdown.
    // For this demo, we'll append a new phase to the task.md

    const newTaskEntry = `
- [ ] **Phase: Implement ${featureName}**
    - [ ] Create core logic for ${featureName}
    - [ ] Verify ${featureName} against spec
    - [ ] Sign-off (Human Accountable)
`;

    fs.appendFileSync(taskMdPath, newTaskEntry);

    console.log(`\n✅ [SDD] Task entries added to: ${taskMdPath}`);
    console.log(`\n🚀 [SDLC] Ready for implementation.`);
}

taskify();
