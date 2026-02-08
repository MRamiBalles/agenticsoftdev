
import fs from 'fs';
import path from 'path';

const ADR_DIR = path.join(process.cwd(), 'docs', 'adr');
const OUTPUT_FILE = path.join(process.cwd(), '.ai', 'knowledge_base', 'adr_summary.json');

interface ADRSummary {
    id: string;
    title: string;
    status: string;
    date: string;
    decision: string;
}

function indexADRs() {
    console.log(`🧠 Indexing Project Memory (ADRs) from ${ADR_DIR}...`);

    if (!fs.existsSync(ADR_DIR)) {
        console.error("ADR Directory not found.");
        return;
    }

    const files = fs.readdirSync(ADR_DIR).filter(f => f.endsWith('.md') && f !== 'template.md');
    const memory: ADRSummary[] = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(ADR_DIR, file), 'utf-8');

        // Simple parsing using Regex
        const titleMatch = content.match(/^# (ADR-\d+): (.+)$/m);
        const dateMatch = content.match(/^\*\*Date:\*\* (.*)$/m);
        const statusMatch = content.match(/^\*\*Status:\*\* (.*)$/m);
        const decisionMatch = content.match(/## Decision\n([\s\S]*?)\n## Consequences/);

        if (titleMatch && statusMatch) {
            const status = statusMatch[1].trim();

            // We only index active decisions for the "Working Memory"
            if (status === 'ACCEPTED' || status === 'PROPOSED') {
                memory.push({
                    id: titleMatch[1],
                    title: titleMatch[2],
                    date: dateMatch ? dateMatch[1].trim() : 'Unknown',
                    status: status,
                    decision: decisionMatch ? decisionMatch[1].trim().substring(0, 500) + "..." : "No decision summary found."
                });
            }
        }
    });

    // Ensure output dir exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(memory, null, 2));
    console.log(`✅ Indexed ${memory.length} active decisions.`);
    console.log(`💾 Memory stored at: ${OUTPUT_FILE}`);
}

indexADRs();
