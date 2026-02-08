
import * as fs from 'fs';
import * as path from 'path';

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

function queryConstitution() {
    // 1. Get Query
    let query = process.argv.slice(2).join(' ').toLowerCase();
    // Clean up CLI artifacts (quotes, backslashes)
    query = query.replace(/^["'\\]+|["'\\]+$/g, '').trim();

    if (!query) {
        console.error("❌ Usage: npx tsx scripts/governance/query_constitution.ts \"my question\"");
        process.exit(1);
    }

    console.log(`🔍 [RAG] Querying Sovereign Law: "${query}"...`);

    // 2. Load Index
    if (!fs.existsSync(INDEX_PATH)) {
        console.error("❌ Index not found. Run 'npx tsx scripts/governance/index_constitution.ts' first.");
        process.exit(1);
    }
    const knowledgeBase: Article[] = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));

    // 3. Simple Relevance Search (TF-IDF Proxy)
    const results: { id: string; text: string; score: number }[] = [];
    const queryTokens = query.split(/[^a-z0-9]+/); // Split by non-alphanumeric

    knowledgeBase.forEach(article => {
        // Search Title
        let score = 0;
        if (article.title.toLowerCase().includes(query)) score += 20;

        queryTokens.forEach(token => {
            if (token.length < 3) return;
            if (article.title.toLowerCase().includes(token)) score += 5;
            if (article.full_text.toLowerCase().includes(token)) score += 1; // Base relevance
        });

        if (score > 0) {
            results.push({ id: article.id, text: article.title, score });
        }

        // Search Clauses
        article.clauses.forEach(clause => {
            let clauseScore = 0;
            if (clause.text.toLowerCase().includes(query)) clauseScore += 30; // Exact match bonus

            queryTokens.forEach(token => {
                if (token.length < 3) return;
                if (clause.text.toLowerCase().includes(token)) clauseScore += 5;
            });

            if (clauseScore > 0) {
                results.push({ id: clause.id, text: clause.text, score: clauseScore });
            }
        });
    });

    // 4. Sort & Display
    results.sort((a, b) => b.score - a.score);
    // Dedup by ID
    const uniqueResults = results.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    const topResults = uniqueResults.slice(0, 3);

    if (topResults.length === 0) {
        console.log("🤷‍♂️ No specific constitutional article found matching your query.");
    } else {
        console.log(`✅ Found ${topResults.length} relevant citations:\n`);
        topResults.forEach(r => {
            console.log(`   📜 [${r.id}] (Relevance: ${r.score})`);
            console.log(`      "${r.text}"\n`);
        });
    }
}

queryConstitution();
