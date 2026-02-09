/**
 * Semantic Chunker: Intelligent Document Segmentation
 * 
 * Parses markdown documents (Constitution, ADRs, Decisions) into
 * atomic knowledge chunks with structured metadata facets.
 * 
 * Chunking Strategy: Section-based (not fixed-size)
 *   - Splits on heading boundaries (##, ###)
 *   - Preserves heading hierarchy as context
 *   - Extracts facets: domain, status, impact, constitutional_ref
 * 
 * Phase 3.1: Protocolo Mnemosyne
 */

import * as crypto from 'crypto';

// ─── Types ───

export type SourceType = 'constitution' | 'adr' | 'decision' | 'session_summary';
export type Domain = 'security' | 'persistence' | 'frontend' | 'netcode' | 'governance' | 'architecture' | 'testing' | 'general';
export type Status = 'active' | 'deprecated' | 'proposed';
export type Impact = 'critical' | 'high' | 'standard' | 'low';

export interface KnowledgeChunk {
    content: string;
    source_type: SourceType;
    source_file: string;
    source_hash: string;
    chunk_index: number;
    domain: Domain;
    status: Status;
    impact: Impact;
    constitutional_ref: string | null;
    tags: string[];
}

export interface ChunkingOptions {
    /** Minimum chunk size in characters (skip tiny fragments) */
    minChunkSize: number;
    /** Maximum chunk size in characters (split oversized sections) */
    maxChunkSize: number;
}

const DEFAULT_OPTIONS: ChunkingOptions = {
    minChunkSize: 50,
    maxChunkSize: 2000,
};

// ─── Domain Detection Keywords ───

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
    security: ['secret', 'credential', 'api key', 'token', 'injection', 'vulnerability', 'cve', 'firewall', 'shield', 'encryption', 'auth', 'password', 'sanitiz'],
    persistence: ['database', 'postgresql', 'supabase', 'sql', 'migration', 'storage', 'redis', 'cache', 'pgvector', 'mongo'],
    frontend: ['react', 'vite', 'shadcn', 'component', 'ui', 'css', 'tailwind', 'dashboard', 'render'],
    netcode: ['network', 'multiplayer', 'server authority', 'client prediction', 'latency', 'tick', 'reconciliation', 'enet', 'flatbuffers'],
    governance: ['constitution', 'raci', 'accountable', 'responsible', 'audit', 'compliance', 'iso 42001', 'eu ai act', 'sovereignty', 'override', 'veto'],
    architecture: ['dependency', 'cycle', 'module', 'coupling', 'complexity', 'atdi', 'smell', 'refactor', 'structure', 'pattern', 'god component'],
    testing: ['test', 'vitest', 'jest', 'sabotage', 'chaos', 'regression', 'validation'],
    general: [],
};

// ─── Impact Detection ───

const CRITICAL_MARKERS = ['severity 10', 'critical', 'forbidden', 'prohibited', 'shall not', 'must not', 'iron rule', 'gold rule', 'immutable', 'block', '+500'];
const HIGH_MARKERS = ['required', 'mandatory', 'must', 'shall', 'warning', '+100'];

// ─── Constitutional Reference Extraction ───

const ARTICLE_PATTERN = /Article\s+([IVXLC]+(?:\.\d+)?)/gi;
const ADR_PATTERN = /ADR-(\d+)/gi;

// ─── Chunker Implementation ───

export class SemanticChunker {
    private options: ChunkingOptions;

    constructor(options?: Partial<ChunkingOptions>) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Chunks a markdown document into semantic knowledge fragments.
     */
    public chunk(params: {
        content: string;
        sourceFile: string;
        sourceType: SourceType;
        statusOverride?: Status;
    }): KnowledgeChunk[] {
        const { content, sourceFile, sourceType, statusOverride } = params;
        const sourceHash = this.sha256(content);
        const sections = this.splitIntoSections(content);
        const documentStatus = statusOverride ?? this.detectDocumentStatus(content);
        const chunks: KnowledgeChunk[] = [];

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (section.text.trim().length < this.options.minChunkSize) continue;

            // Split oversized sections
            const textParts = this.splitIfOversized(section.text);

            for (let j = 0; j < textParts.length; j++) {
                const text = textParts[j];
                const chunkContent = section.heading
                    ? `## ${section.heading}\n${text}`
                    : text;

                chunks.push({
                    content: chunkContent.trim(),
                    source_type: sourceType,
                    source_file: sourceFile,
                    source_hash: sourceHash,
                    chunk_index: chunks.length,
                    domain: this.detectDomain(chunkContent),
                    status: documentStatus,
                    impact: this.detectImpact(chunkContent),
                    constitutional_ref: this.extractConstitutionalRef(chunkContent),
                    tags: this.extractTags(chunkContent, sourceType),
                });
            }
        }

        return chunks;
    }

    /**
     * Chunks the constitution specifically, treating each Article as a chunk
     * and each clause as a sub-chunk.
     */
    public chunkConstitution(content: string, sourceFile: string): KnowledgeChunk[] {
        const sourceHash = this.sha256(content);
        const chunks: KnowledgeChunk[] = [];

        // Split by Article headers
        const articlePattern = /^##\s+(Article\s+[IVXLC]+:?.*)$/gm;
        const articles: { heading: string; startIdx: number }[] = [];
        let match;

        while ((match = articlePattern.exec(content)) !== null) {
            articles.push({ heading: match[1], startIdx: match.index });
        }

        for (let i = 0; i < articles.length; i++) {
            const start = articles[i].startIdx;
            const end = i + 1 < articles.length ? articles[i + 1].startIdx : content.length;
            const articleText = content.slice(start, end).trim();

            // Each Article is a chunk
            chunks.push({
                content: articleText,
                source_type: 'constitution',
                source_file: sourceFile,
                source_hash: sourceHash,
                chunk_index: chunks.length,
                domain: this.detectDomain(articleText),
                status: 'active',
                impact: this.detectImpact(articleText),
                constitutional_ref: this.extractConstitutionalRef(articleText) ?? articles[i].heading,
                tags: ['constitution', ...this.extractTags(articleText, 'constitution')],
            });

            // Also chunk individual clauses (### level)
            const clausePattern = /^###\s+(\d+\..*?)$([\s\S]*?)(?=^###|\Z)/gm;
            let clauseMatch;
            while ((clauseMatch = clausePattern.exec(articleText)) !== null) {
                const clauseText = `${articles[i].heading} > ${clauseMatch[1]}\n${clauseMatch[2]}`.trim();
                if (clauseText.length >= this.options.minChunkSize) {
                    chunks.push({
                        content: clauseText,
                        source_type: 'constitution',
                        source_file: sourceFile,
                        source_hash: sourceHash,
                        chunk_index: chunks.length,
                        domain: this.detectDomain(clauseText),
                        status: 'active',
                        impact: this.detectImpact(clauseText),
                        constitutional_ref: this.extractConstitutionalRef(clauseText),
                        tags: ['constitution', 'clause', ...this.extractTags(clauseText, 'constitution')],
                    });
                }
            }
        }

        // If no articles found, fall back to generic chunking
        if (chunks.length === 0) {
            return this.chunk({ content, sourceFile, sourceType: 'constitution' });
        }

        return chunks;
    }

    // ─── Section Splitting ───

    private splitIntoSections(content: string): { heading: string | null; text: string }[] {
        const lines = content.split('\n');
        const sections: { heading: string | null; text: string }[] = [];
        let currentHeading: string | null = null;
        let currentLines: string[] = [];

        for (const line of lines) {
            const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
            if (headingMatch) {
                // Flush previous section
                if (currentLines.length > 0) {
                    sections.push({ heading: currentHeading, text: currentLines.join('\n') });
                }
                currentHeading = headingMatch[1];
                currentLines = [];
            } else {
                currentLines.push(line);
            }
        }

        // Flush last section
        if (currentLines.length > 0) {
            sections.push({ heading: currentHeading, text: currentLines.join('\n') });
        }

        return sections;
    }

    private splitIfOversized(text: string): string[] {
        if (text.length <= this.options.maxChunkSize) return [text];

        const parts: string[] = [];
        const paragraphs = text.split(/\n\n+/);
        let current = '';

        for (const para of paragraphs) {
            if (current.length + para.length > this.options.maxChunkSize && current.length > 0) {
                parts.push(current.trim());
                current = '';
            }
            current += (current ? '\n\n' : '') + para;
        }

        if (current.trim().length > 0) {
            parts.push(current.trim());
        }

        return parts.length > 0 ? parts : [text];
    }

    // ─── Facet Detection ───

    private detectDomain(text: string): Domain {
        const lowerText = text.toLowerCase();
        let bestDomain: Domain = 'general';
        let bestScore = 0;

        for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
            if (domain === 'general') continue;
            const score = keywords.filter(kw => lowerText.includes(kw)).length;
            if (score > bestScore) {
                bestScore = score;
                bestDomain = domain as Domain;
            }
        }

        return bestDomain;
    }

    private detectImpact(text: string): Impact {
        const lowerText = text.toLowerCase();

        if (CRITICAL_MARKERS.some(m => lowerText.includes(m))) return 'critical';
        if (HIGH_MARKERS.some(m => lowerText.includes(m))) return 'high';
        return 'standard';
    }

    private detectDocumentStatus(content: string): Status {
        const statusMatch = content.match(/^\*\*Status:\*\*\s*(\w+)/mi);
        if (!statusMatch) return 'active';

        const status = statusMatch[1].toUpperCase();
        if (status === 'DEPRECATED' || status === 'REJECTED') return 'deprecated';
        if (status === 'PROPOSED') return 'proposed';
        return 'active';
    }

    private extractConstitutionalRef(text: string): string | null {
        const refs: string[] = [];

        let match;
        const articleRegex = new RegExp(ARTICLE_PATTERN.source, ARTICLE_PATTERN.flags);
        while ((match = articleRegex.exec(text)) !== null) {
            refs.push(`Article ${match[1]}`);
        }

        const adrRegex = new RegExp(ADR_PATTERN.source, ADR_PATTERN.flags);
        while ((match = adrRegex.exec(text)) !== null) {
            refs.push(`ADR-${match[1]}`);
        }

        return refs.length > 0 ? refs.join(', ') : null;
    }

    private extractTags(text: string, sourceType: SourceType): string[] {
        const tags: string[] = [];
        const lowerText = text.toLowerCase();

        // Extract technology-specific tags
        const techTerms = ['react', 'vite', 'typescript', 'postgresql', 'supabase', 'docker', 'pgvector', 'redis', 'enet'];
        for (const term of techTerms) {
            if (lowerText.includes(term)) tags.push(term);
        }

        // Source type tag
        tags.push(sourceType);

        return [...new Set(tags)];
    }

    // ─── Helpers ───

    private sha256(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}
