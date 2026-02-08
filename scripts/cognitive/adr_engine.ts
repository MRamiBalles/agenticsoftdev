
import * as fs from 'fs';
import * as path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'docs', 'decisions');

interface AdrContext {
    title: string;
    status: 'PROPOSED' | 'ACCEPTED' | 'DEPRECATED' | 'REJECTED';
    context: string;
    decision: string;
    consequences: string;
}

function getNextId(): string {
    if (!fs.existsSync(DOCS_DIR)) return '0001';

    const files = fs.readdirSync(DOCS_DIR).filter(f => f.match(/^\d{4}-.*\.md$/));
    if (files.length === 0) return '0001';

    const lastFile = files.sort().pop();
    const lastId = parseInt(lastFile!.split('-')[0]);
    return (lastId + 1).toString().padStart(4, '0');
}

function generateAdr() {
    console.log("🏛️ [ADR Engine] Initializing new Architecture Decision Record...");

    // Parse CLI Args
    const args = process.argv.slice(2);
    const title = args.find(arg => arg.startsWith('--title='))?.split('=')[1] || 'Untitled_Decision';
    const context = args.find(arg => arg.startsWith('--context='))?.split('=')[1] || 'Context not provided.';
    const decision = args.find(arg => arg.startsWith('--decision='))?.split('=')[1] || 'Decision not provided.';

    const id = getNextId();
    const filename = `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    const filepath = path.join(DOCS_DIR, filename);

    const template = `# ${id}. ${title.replace(/_/g, ' ')}

Date: ${new Date().toISOString().split('T')[0]}
Status: PROPOSED

## Context
${context}

## Decision
${decision}

## Consequences
*   **Positive:** [Benefit 1]
*   **Negative:** [Drawback 1]
*   **Risks:** [Risk 1]
`;

    if (!fs.existsSync(DOCS_DIR)) {
        fs.mkdirSync(DOCS_DIR, { recursive: true });
    }

    fs.writeFileSync(filepath, template);
    console.log(`✅ [ADR Engine] Created ADR: ${filepath}`);

    // Update Index (Optional but good for Institutional Memory)
    updateIndex();
}

function updateIndex() {
    const indexFile = path.join(DOCS_DIR, 'README.md');
    const files = fs.readdirSync(DOCS_DIR).filter(f => f.match(/^\d{4}-.*\.md$/)).sort();

    let content = `# Architecture Decision Records\n\n| ID | Title | Status |\n|---|---|---|\n`;

    files.forEach(file => {
        const text = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
        const titleMatch = text.match(/^# (\d+\. .*)/);
        const statusMatch = text.match(/Status: (.*)/);

        const title = titleMatch ? titleMatch[1] : file;
        const status = statusMatch ? statusMatch[1] : 'UNKNOWN';

        content += `| [${file.split('-')[0]}](${file}) | ${title} | ${status} |\n`;
    });

    fs.writeFileSync(indexFile, content);
    console.log(`📚 [ADR Engine] Index updated: ${indexFile}`);
}

generateAdr();
