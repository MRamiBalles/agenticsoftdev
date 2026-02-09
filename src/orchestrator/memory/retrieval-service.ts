/**
 * Retrieval Service: Semantic Search over Institutional Memory
 * 
 * Provides the query interface for agents to search knowledge_vectors.
 * Supports:
 *   - Semantic similarity search (cosine distance via pgvector)
 *   - Facet filtering (domain, status, source_type)
 *   - RBAC enforcement (Builder=READ, Architect=READ+WRITE)
 *   - Context assembly for prompt injection
 *   - Local fallback when Supabase is unavailable
 * 
 * Phase 3.1: Protocolo Mnemosyne
 * Compliance: constitution.md Art. VII.2
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeChunk, Domain, Status, SourceType } from './semantic-chunker';
import { generateLocalEmbedding } from './ingest-pipeline';
import type { AgentRole } from '../security-gate';

// ─── Types ───

export interface RetrievalQuery {
    /** Natural language query or keywords */
    query: string;
    /** Agent role performing the query (for RBAC) */
    agentRole: AgentRole;
    /** Filter by domain */
    domain?: Domain;
    /** Filter by source type */
    sourceType?: SourceType;
    /** Minimum similarity threshold (0-1) */
    threshold?: number;
    /** Maximum number of results */
    topK?: number;
}

export interface RetrievalResult {
    chunks: RetrievedChunk[];
    query: string;
    totalMatches: number;
    searchDurationMs: number;
}

export interface RetrievedChunk {
    content: string;
    source_type: SourceType;
    source_file: string;
    domain: Domain;
    status: Status;
    impact: string;
    constitutional_ref: string | null;
    tags: string[];
    similarity: number;
}

// ─── RBAC for Memory Access ───

const MEMORY_READ_ROLES: AgentRole[] = ['architect', 'builder', 'guardian', 'strategist'];
const MEMORY_WRITE_ROLES: AgentRole[] = ['architect', 'strategist'];

// ─── Local Vector Store (Fallback) ───

interface LocalVectorEntry {
    chunk: KnowledgeChunk;
    embedding: number[];
}

// ─── Retrieval Service ───

export class RetrievalService {
    private localStore: LocalVectorEntry[] = [];
    private localStorePath: string;
    private useLocalFallback: boolean;

    constructor(projectRoot: string, options?: { forceLocal?: boolean }) {
        this.localStorePath = path.join(projectRoot, '.ai', 'knowledge_base', 'vectors.json');
        this.useLocalFallback = options?.forceLocal ?? true; // Default to local for sovereignty

        // Load existing local store
        this.loadLocalStore();

        console.log(`🔍 Retrieval Service initialized. Mode: ${this.useLocalFallback ? 'LOCAL (sovereign)' : 'SUPABASE'}`);
        console.log(`   Indexed chunks: ${this.localStore.length}`);
    }

    /**
     * Searches institutional memory for relevant knowledge.
     * Enforces RBAC before returning results.
     */
    public search(query: RetrievalQuery): RetrievalResult {
        const startTime = Date.now();

        // RBAC Check
        if (!this.canRead(query.agentRole)) {
            console.error(`🚫 RBAC: Agent [${query.agentRole}] lacks MEMORY_READ permission`);
            return {
                chunks: [],
                query: query.query,
                totalMatches: 0,
                searchDurationMs: Date.now() - startTime,
            };
        }

        const threshold = query.threshold ?? 0.3;
        const topK = query.topK ?? 5;

        let results: RetrievedChunk[];

        if (this.useLocalFallback) {
            results = this.localSearch(query.query, threshold, topK, query.domain, query.sourceType);
        } else {
            // TODO: Implement Supabase RPC call to match_knowledge()
            // For now, fall back to local
            results = this.localSearch(query.query, threshold, topK, query.domain, query.sourceType);
        }

        const durationMs = Date.now() - startTime;

        console.log(`🔍 Query: "${query.query.slice(0, 60)}..." → ${results.length} results (${durationMs}ms)`);

        return {
            chunks: results,
            query: query.query,
            totalMatches: results.length,
            searchDurationMs: durationMs,
        };
    }

    /**
     * Ingests chunks into the local vector store.
     * Enforces RBAC: only architect/strategist can write.
     */
    public ingestChunks(chunks: (KnowledgeChunk & { embedding: number[] })[], writerRole: AgentRole): number {
        if (!this.canWrite(writerRole)) {
            console.error(`🚫 RBAC: Agent [${writerRole}] lacks MEMORY_WRITE permission`);
            return 0;
        }

        // Clear existing chunks from same source files to avoid duplicates
        const sourceFiles = new Set(chunks.map(c => c.source_file));
        this.localStore = this.localStore.filter(entry => !sourceFiles.has(entry.chunk.source_file));

        // Add new chunks
        for (const chunk of chunks) {
            const { embedding, ...chunkData } = chunk;
            this.localStore.push({ chunk: chunkData, embedding });
        }

        this.saveLocalStore();

        console.log(`📥 Ingested ${chunks.length} chunks. Total: ${this.localStore.length}`);
        return chunks.length;
    }

    /**
     * Assembles retrieved chunks into a formatted context string
     * suitable for injection into an agent's system prompt.
     */
    public assembleContext(results: RetrievalResult): string {
        if (results.chunks.length === 0) {
            return '## Institutional Memory\nNo relevant precedents found for this task.';
        }

        const lines: string[] = [
            '## Institutional Memory (Retrieved Precedents)',
            `_Query: "${results.query}" | ${results.totalMatches} matches | ${results.searchDurationMs}ms_\n`,
        ];

        for (let i = 0; i < results.chunks.length; i++) {
            const chunk = results.chunks[i];
            const header = [
                `### [${i + 1}] ${chunk.source_type.toUpperCase()}`,
                chunk.constitutional_ref ? `(${chunk.constitutional_ref})` : '',
                `— ${chunk.domain}`,
                `[${chunk.impact}]`,
                `(similarity: ${(chunk.similarity * 100).toFixed(1)}%)`,
            ].filter(Boolean).join(' ');

            lines.push(header);
            lines.push(`> Source: \`${chunk.source_file}\``);
            lines.push(`> Status: ${chunk.status} | Tags: ${chunk.tags.join(', ')}\n`);
            lines.push(chunk.content);
            lines.push('');
        }

        lines.push('---');
        lines.push('_⚠️ The above constraints are BINDING. Violating them requires a Constitutional Amendment (ADR)._');

        return lines.join('\n');
    }

    /**
     * Returns summary statistics about the knowledge base.
     */
    public getStats(): {
        totalChunks: number;
        bySourceType: Record<string, number>;
        byDomain: Record<string, number>;
        byStatus: Record<string, number>;
    } {
        const bySourceType: Record<string, number> = {};
        const byDomain: Record<string, number> = {};
        const byStatus: Record<string, number> = {};

        for (const entry of this.localStore) {
            bySourceType[entry.chunk.source_type] = (bySourceType[entry.chunk.source_type] || 0) + 1;
            byDomain[entry.chunk.domain] = (byDomain[entry.chunk.domain] || 0) + 1;
            byStatus[entry.chunk.status] = (byStatus[entry.chunk.status] || 0) + 1;
        }

        return {
            totalChunks: this.localStore.length,
            bySourceType,
            byDomain,
            byStatus,
        };
    }

    // ─── RBAC Helpers ───

    public canRead(role: AgentRole): boolean {
        return MEMORY_READ_ROLES.includes(role);
    }

    public canWrite(role: AgentRole): boolean {
        return MEMORY_WRITE_ROLES.includes(role);
    }

    // ─── Local Vector Search (Cosine Similarity) ───

    private localSearch(
        query: string,
        threshold: number,
        topK: number,
        filterDomain?: Domain,
        filterSourceType?: SourceType,
    ): RetrievedChunk[] {
        const queryEmbedding = generateLocalEmbedding(query);

        const scored: { entry: LocalVectorEntry; similarity: number }[] = [];

        for (const entry of this.localStore) {
            // Filter by status (exclude deprecated — memory poisoning defense)
            if (entry.chunk.status === 'deprecated') continue;

            // Apply facet filters
            if (filterDomain && entry.chunk.domain !== filterDomain) continue;
            if (filterSourceType && entry.chunk.source_type !== filterSourceType) continue;

            const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
            if (similarity >= threshold) {
                scored.push({ entry, similarity });
            }
        }

        // Sort by similarity descending, take topK
        scored.sort((a, b) => b.similarity - a.similarity);
        const topResults = scored.slice(0, topK);

        return topResults.map(({ entry, similarity }) => ({
            content: entry.chunk.content,
            source_type: entry.chunk.source_type,
            source_file: entry.chunk.source_file,
            domain: entry.chunk.domain,
            status: entry.chunk.status,
            impact: entry.chunk.impact,
            constitutional_ref: entry.chunk.constitutional_ref,
            tags: entry.chunk.tags,
            similarity,
        }));
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }

    // ─── Local Store Persistence ───

    private loadLocalStore(): void {
        if (fs.existsSync(this.localStorePath)) {
            try {
                const data = fs.readFileSync(this.localStorePath, 'utf-8');
                this.localStore = JSON.parse(data);
            } catch {
                console.warn('⚠️ Failed to load local vector store. Starting fresh.');
                this.localStore = [];
            }
        }
    }

    private saveLocalStore(): void {
        const dir = path.dirname(this.localStorePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.localStorePath, JSON.stringify(this.localStore));
    }
}
