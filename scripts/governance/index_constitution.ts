
import * as fs from 'fs';
import * as path from 'path';

const CONSTITUTION_PATH = path.join(process.cwd(), '.specify/memory/constitution.md');
const INDEX_PATH = path.join(process.cwd(), 'src', 'knowledge', 'constitution_index.json');

interface Clause {
    id: string;
    text: string;
}

interface Article {
    id: string;
    title: string;
    full_text: string;
    clauses: Clause[];
}

function parseConstitution() {
    console.log("📜 [Indexer] Parsing Constitution...");

    if (!fs.existsSync(CONSTITUTION_PATH)) {
        console.error("❌ Constitution not found!");
        process.exit(1);
    }

    const text = fs.readFileSync(CONSTITUTION_PATH, 'utf-8');
    const sections = text.split(/^## /gm).slice(1); // Skip Preamble if it doesn't start with ## or handle it

    const knowledgeBase: Article[] = [];

    sections.forEach(section => {
        const lines = section.split('\n');
        const titleLine = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();

        // Extract ID (e.g., "Article I")
        const idMatch = titleLine.match(/Article [IVX]+/);
        const id = idMatch ? idMatch[0] : "Preamble";
        const title = titleLine.replace(id, '').replace(/^:\s*/, '').trim();

        // Extract Clauses (lines starting with number, e.g., "1. ")
        const clauses: Clause[] = [];
        const clauseRegex = /^(\d+)\.\s+(.*)/gm;
        let match;
        while ((match = clauseRegex.exec(content)) !== null) {
            clauses.push({
                id: `${id}.${match[1]}`, // e.g., Article I.1
                text: match[2].trim()
            });
        }

        knowledgeBase.push({
            id,
            title,
            full_text: content,
            clauses
        });

        console.log(`   - Indexed: ${id}: ${title} (${clauses.length} clauses)`);
    });

    // Ensure dir
    const dir = path.dirname(INDEX_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(INDEX_PATH, JSON.stringify(knowledgeBase, null, 2));
    console.log(`✅ [Indexer] Constitution Vectorized (Structured) to: ${INDEX_PATH}`);
}

parseConstitution();
