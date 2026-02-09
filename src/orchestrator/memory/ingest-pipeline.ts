/**
 * Vector Ingestion Pipeline: Document → Chunks → Embeddings → pgvector
 * 
 * Reads institutional documents (Constitution, ADRs, Decisions),
 * chunks them semantically, generates embeddings, and upserts
 * into the knowledge_vectors table.
 * 
 * Embedding Strategy: Local TF-IDF sparse vectors (no external API dependency)
 * For production, swap to Supabase Edge Function with a real embedding model.
 * 
 * Phase 3.1: Protocolo Mnemosyne
 * Compliance: constitution.md Art. VII.2 (Intent of the Legislator)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SemanticChunker, KnowledgeChunk, SourceType } from './semantic-chunker';

// ─── Types ───

export interface IngestResult {
    totalDocuments: number;
    totalChunks: number;
    newChunks: number;
    skippedUnchanged: number;
    errors: string[];
}

export interface IngestConfig {
    /** Project root directory */
    projectRoot: string;
    /** Document sources to ingest */
    sources: DocumentSource[];
}

export interface DocumentSource {
    /** Glob-friendly directory or single file path (relative to projectRoot) */
    path: string;
    /** Source type classification */
    sourceType: SourceType;
    /** Only ingest files matching this pattern */
    filePattern?: RegExp;
    /** Skip files matching this pattern */
    excludePattern?: RegExp;
}

// ─── Default Sources ───

const DEFAULT_SOURCES: DocumentSource[] = [
    {
        path: 'docs/governance/constitution.md',
        sourceType: 'constitution',
    },
    {
        path: 'docs/adr',
        sourceType: 'adr',
        filePattern: /^\d+.*\.md$/,
        excludePattern: /template\.md$/,
    },
    {
        path: 'docs/decisions',
        sourceType: 'decision',
        filePattern: /\.md$/,
        excludePattern: /README\.md$/,
    },
];

// ─── Local Embedding (TF-IDF Sparse → Dense Projection) ───

/**
 * Generates a simple TF-IDF-inspired embedding for local/sovereign operation.
 * This is a lightweight fallback; for production, use a real embedding model
 * via Supabase Edge Function or local ONNX runtime.
 * 
 * Output: 384-dimensional float array (matching pgvector column size).
 */
function generateLocalEmbedding(text: string): number[] {
    const DIMS = 384;
    const vector = new Array(DIMS).fill(0);

    // Tokenize: lowercase, split on non-alphanumeric
    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
    const tokenSet = new Set(tokens);
    const totalTokens = tokens.length || 1;

    // Hash each unique token into a dimension and accumulate TF weight
    for (const token of tokenSet) {
        const tf = tokens.filter(t => t === token).length / totalTokens;
        const hash = crypto.createHash('md5').update(token).digest();

        // Distribute token signal across multiple dimensions for density
        for (let i = 0; i < 4; i++) {
            const dimIdx = hash.readUInt16BE(i * 2) % DIMS;
            const sign = (hash[8 + i] & 1) === 0 ? 1 : -1;
            vector[dimIdx] += sign * tf;
        }
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => Number((v / norm).toFixed(6)));
}

// ─── Ingestion State Tracking ───

interface IngestState {
    [sourceFile: string]: string; // source_file → source_hash
}

function loadIngestState(projectRoot: string): IngestState {
    const statePath = path.join(projectRoot, '.ai', 'knowledge_base', 'ingest_state.json');
    if (fs.existsSync(statePath)) {
        try {
            return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        } catch {
            return {};
        }
    }
    return {};
}

function saveIngestState(projectRoot: string, state: IngestState): void {
    const dir = path.join(projectRoot, '.ai', 'knowledge_base');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'ingest_state.json'), JSON.stringify(state, null, 2));
}

// ─── Pipeline Implementation ───

export class IngestPipeline {
    private chunker: SemanticChunker;
    private projectRoot: string;
    private sources: DocumentSource[];

    constructor(config: Partial<IngestConfig> = {}) {
        this.projectRoot = config.projectRoot ?? process.cwd();
        this.sources = config.sources ?? DEFAULT_SOURCES;
        this.chunker = new SemanticChunker();

        console.log('📥 Ingest Pipeline initialized.');
        console.log(`   Project root: ${this.projectRoot}`);
        console.log(`   Sources: ${this.sources.length}`);
    }

    /**
     * Runs the full ingestion pipeline.
     * Returns chunks ready for insertion (with embeddings).
     * 
     * The actual DB insert is delegated to the caller (RetrievalService)
     * to maintain separation of concerns and testability.
     */
    public async ingest(): Promise<{ chunks: (KnowledgeChunk & { embedding: number[] })[]; result: IngestResult }> {
        console.log('\n🧠 Starting knowledge ingestion...\n');

        const state = loadIngestState(this.projectRoot);
        const result: IngestResult = {
            totalDocuments: 0,
            totalChunks: 0,
            newChunks: 0,
            skippedUnchanged: 0,
            errors: [],
        };

        const allChunks: (KnowledgeChunk & { embedding: number[] })[] = [];

        for (const source of this.sources) {
            const files = this.resolveFiles(source);

            for (const filePath of files) {
                result.totalDocuments++;
                const relativePath = path.relative(this.projectRoot, filePath).replace(/\\/g, '/');

                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const currentHash = crypto.createHash('sha256').update(content).digest('hex');

                    // Skip unchanged documents
                    if (state[relativePath] === currentHash) {
                        console.log(`   ⏭️  Skipping (unchanged): ${relativePath}`);
                        result.skippedUnchanged++;
                        continue;
                    }

                    console.log(`   📄 Processing: ${relativePath} (${source.sourceType})`);

                    // Chunk the document
                    let chunks: KnowledgeChunk[];
                    if (source.sourceType === 'constitution') {
                        chunks = this.chunker.chunkConstitution(content, relativePath);
                    } else {
                        chunks = this.chunker.chunk({
                            content,
                            sourceFile: relativePath,
                            sourceType: source.sourceType,
                        });
                    }

                    // Generate embeddings for each chunk
                    for (const chunk of chunks) {
                        const embedding = generateLocalEmbedding(chunk.content);
                        allChunks.push({ ...chunk, embedding });
                        result.totalChunks++;
                        result.newChunks++;
                    }

                    console.log(`      → ${chunks.length} chunks generated`);

                    // Update state
                    state[relativePath] = currentHash;

                } catch (error) {
                    const msg = `Failed to process ${relativePath}: ${(error as Error).message}`;
                    console.error(`   ❌ ${msg}`);
                    result.errors.push(msg);
                }
            }
        }

        // Save ingestion state
        saveIngestState(this.projectRoot, state);

        console.log(`\n📊 Ingestion Summary:`);
        console.log(`   Documents: ${result.totalDocuments} (${result.skippedUnchanged} unchanged)`);
        console.log(`   Chunks: ${result.totalChunks} (${result.newChunks} new)`);
        if (result.errors.length > 0) {
            console.log(`   Errors: ${result.errors.length}`);
        }

        return { chunks: allChunks, result };
    }

    /**
     * Forces re-ingestion of all documents (ignores state cache).
     */
    public async reingest(): Promise<{ chunks: (KnowledgeChunk & { embedding: number[] })[]; result: IngestResult }> {
        const statePath = path.join(this.projectRoot, '.ai', 'knowledge_base', 'ingest_state.json');
        if (fs.existsSync(statePath)) {
            fs.unlinkSync(statePath);
        }
        return this.ingest();
    }

    // ─── File Resolution ───

    private resolveFiles(source: DocumentSource): string[] {
        const fullPath = path.resolve(this.projectRoot, source.path);

        if (!fs.existsSync(fullPath)) {
            console.warn(`   ⚠️ Source not found: ${source.path}`);
            return [];
        }

        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
            return [fullPath];
        }

        if (stat.isDirectory()) {
            return fs.readdirSync(fullPath)
                .filter(f => {
                    if (source.filePattern && !source.filePattern.test(f)) return false;
                    if (source.excludePattern && source.excludePattern.test(f)) return false;
                    return true;
                })
                .map(f => path.join(fullPath, f));
        }

        return [];
    }
}

// ─── Standalone Embedding Export (for RetrievalService queries) ───

export { generateLocalEmbedding };
