/**
 * Retrieval Service & Semantic Chunker Tests
 * 
 * Validates: chunking, facet extraction, RBAC, search, context assembly.
 * Phase 3.1: Protocolo Mnemosyne
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SemanticChunker } from '../../src/orchestrator/memory/semantic-chunker';
import { RetrievalService } from '../../src/orchestrator/memory/retrieval-service';
import { generateLocalEmbedding } from '../../src/orchestrator/memory/ingest-pipeline';

// ─── Test Fixtures ───

const SAMPLE_CONSTITUTION = `# The Constitution of AgenticSoftDev

## Article I: The Core
### 1. Human Authority
- No code shall be deployed to production without Human Sign-off.
- The Human spec.md is the source of truth.

### 2. Operational Hygiene
- **No Secrets:** API Keys and Credentials must never be hardcoded. Use .env.
- **No Opaque Blobs:** All binary assets must be documented.

## Article III: Architectural Standards
### 1. Zero-Tolerance for Cycles
Circular dependencies between modules are classified as Critical Defects (Severity 10).

### 2. God Component Limit
No single file shall exceed 400 lines of logic.

## Article VI: Technology Stack
### 1. Adherence
All code must adhere to the defined stack:
- **Frontend**: React + Vite + Shadcn UI
- **Backend/DB**: Supabase (PostgreSQL)
- **Language**: TypeScript (Strict Mode)

### 2. Evolution
Changes to the stack require a formal Architecture Decision Record (ADR).
`;

const SAMPLE_ADR = `# ADR-001: Adoption of Spec-Driven Development

**Date:** 2026-02-08
**Status:** ACCEPTED

## Context
Without strict governance, AI agents may introduce unmaintainable code.

## Decision
We will adopt Spec-Driven Development (SDD) as our core methodology.
1. All code changes must follow: /specify -> /plan -> /implement.
2. We enforce strict RACI roles (Human=Accountable, AI=Responsible).

## Consequences

### Positive
- Sovereignty: Humans retain absolute control.
- Quality Guarantee: ATDI prevents long-term project rot.

### Negative
- Velocity Friction: Specs and Plans slow down quick fixes.

## Compliance
- **Constitutional Rule**: Article II.3 (Spec-Driven Execution).
`;

// ─── Semantic Chunker Tests ───

describe('SemanticChunker', () => {
    let chunker: SemanticChunker;

    beforeEach(() => {
        chunker = new SemanticChunker();
    });

    describe('Constitution Chunking', () => {
        it('should chunk constitution into article-level chunks', () => {
            const chunks = chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'docs/governance/constitution.md');
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks.every(c => c.source_type === 'constitution')).toBe(true);
            expect(chunks.every(c => c.status === 'active')).toBe(true);
        });

        it('should detect security domain for Article I', () => {
            const chunks = chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'constitution.md');
            const secretChunk = chunks.find(c => c.content.includes('API Keys'));
            expect(secretChunk).toBeDefined();
            expect(secretChunk!.domain).toBe('security');
        });

        it('should detect architecture domain for Article III', () => {
            const chunks = chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'constitution.md');
            const archChunk = chunks.find(c => c.content.includes('Circular dependencies'));
            expect(archChunk).toBeDefined();
            expect(archChunk!.domain).toBe('architecture');
        });

        it('should detect critical impact for severity 10 items', () => {
            const chunks = chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'constitution.md');
            const criticalChunk = chunks.find(c => c.content.includes('Severity 10'));
            expect(criticalChunk).toBeDefined();
            expect(criticalChunk!.impact).toBe('critical');
        });

        it('should extract constitutional references', () => {
            const chunks = chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'constitution.md');
            const hasRef = chunks.some(c => c.constitutional_ref !== null);
            expect(hasRef).toBe(true);
        });
    });

    describe('ADR Chunking', () => {
        it('should chunk ADR and detect accepted status', () => {
            const chunks = chunker.chunk({
                content: SAMPLE_ADR,
                sourceFile: 'docs/adr/001-sdd.md',
                sourceType: 'adr',
            });
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks.every(c => c.source_type === 'adr')).toBe(true);
            expect(chunks.every(c => c.status === 'active')).toBe(true);
        });

        it('should detect governance domain for SDD ADR', () => {
            const chunks = chunker.chunk({
                content: SAMPLE_ADR,
                sourceFile: 'docs/adr/001-sdd.md',
                sourceType: 'adr',
            });
            const govChunk = chunks.find(c => c.domain === 'governance');
            expect(govChunk).toBeDefined();
        });

        it('should detect deprecated status', () => {
            const deprecatedADR = SAMPLE_ADR.replace('ACCEPTED', 'DEPRECATED');
            const chunks = chunker.chunk({
                content: deprecatedADR,
                sourceFile: 'docs/adr/old.md',
                sourceType: 'adr',
            });
            expect(chunks.every(c => c.status === 'deprecated')).toBe(true);
        });

        it('should extract ADR references from compliance section', () => {
            const chunks = chunker.chunk({
                content: SAMPLE_ADR,
                sourceFile: 'docs/adr/001.md',
                sourceType: 'adr',
            });
            const refChunk = chunks.find(c =>
                c.constitutional_ref !== null && c.constitutional_ref.includes('Article II')
            );
            expect(refChunk).toBeDefined();
        });
    });

    describe('Tag Extraction', () => {
        it('should extract technology tags', () => {
            const chunks = chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'constitution.md');
            const techChunk = chunks.find(c => c.content.includes('React'));
            expect(techChunk).toBeDefined();
            expect(techChunk!.tags).toContain('react');
        });
    });
});

// ─── Retrieval Service Tests ───

describe('RetrievalService', () => {
    let service: RetrievalService;
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
        service = new RetrievalService(tmpDir, { forceLocal: true });

        // Ingest test data
        const chunker = new SemanticChunker();
        const chunks = [
            ...chunker.chunkConstitution(SAMPLE_CONSTITUTION, 'constitution.md'),
            ...chunker.chunk({ content: SAMPLE_ADR, sourceFile: 'adr/001.md', sourceType: 'adr' }),
        ];

        const withEmbeddings = chunks.map(c => ({
            ...c,
            embedding: generateLocalEmbedding(c.content),
        }));

        service.ingestChunks(withEmbeddings, 'architect');
    });

    afterEach(() => {
        // Cleanup tmp
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('RBAC', () => {
        it('should allow all standard roles to read', () => {
            expect(service.canRead('architect')).toBe(true);
            expect(service.canRead('builder')).toBe(true);
            expect(service.canRead('guardian')).toBe(true);
            expect(service.canRead('strategist')).toBe(true);
        });

        it('should only allow architect and strategist to write', () => {
            expect(service.canWrite('architect')).toBe(true);
            expect(service.canWrite('strategist')).toBe(true);
            expect(service.canWrite('builder')).toBe(false);
            expect(service.canWrite('guardian')).toBe(false);
        });

        it('should block builder from ingesting chunks', () => {
            const chunk = {
                content: 'Malicious precedent',
                source_type: 'adr' as const,
                source_file: 'fake.md',
                source_hash: 'abc',
                chunk_index: 0,
                domain: 'general' as const,
                status: 'active' as const,
                impact: 'standard' as const,
                constitutional_ref: null,
                tags: [],
                embedding: generateLocalEmbedding('Malicious precedent'),
            };
            const result = service.ingestChunks([chunk], 'builder');
            expect(result).toBe(0);
        });
    });

    describe('Search', () => {
        it('should find relevant chunks for security queries', () => {
            const results = service.search({
                query: 'API keys credentials secrets hardcoded',
                agentRole: 'architect',
            });
            expect(results.chunks.length).toBeGreaterThan(0);
            // Should find the security-related constitution chunk
            const securityChunk = results.chunks.find(c => c.domain === 'security');
            expect(securityChunk).toBeDefined();
        });

        it('should find relevant chunks for architecture queries', () => {
            const results = service.search({
                query: 'circular dependencies cycles modules coupling',
                agentRole: 'architect',
            });
            expect(results.chunks.length).toBeGreaterThan(0);
        });

        it('should filter by domain', () => {
            const results = service.search({
                query: 'dependencies architecture structure',
                agentRole: 'builder',
                domain: 'architecture',
            });
            for (const chunk of results.chunks) {
                expect(chunk.domain).toBe('architecture');
            }
        });

        it('should filter by source type', () => {
            const results = service.search({
                query: 'governance accountability spec-driven',
                agentRole: 'guardian',
                sourceType: 'adr',
            });
            for (const chunk of results.chunks) {
                expect(chunk.source_type).toBe('adr');
            }
        });

        it('should exclude deprecated chunks', () => {
            // Ingest a deprecated chunk
            const deprecatedChunk = {
                content: 'Old rule: use MongoDB for everything',
                source_type: 'adr' as const,
                source_file: 'old-adr.md',
                source_hash: 'old',
                chunk_index: 0,
                domain: 'persistence' as const,
                status: 'deprecated' as const,
                impact: 'standard' as const,
                constitutional_ref: null,
                tags: [],
                embedding: generateLocalEmbedding('Old rule: use MongoDB for everything'),
            };
            service.ingestChunks([deprecatedChunk], 'architect');

            const results = service.search({
                query: 'MongoDB database persistence',
                agentRole: 'architect',
            });

            const deprecated = results.chunks.find(c => c.status === 'deprecated');
            expect(deprecated).toBeUndefined();
        });
    });

    describe('Context Assembly', () => {
        it('should produce formatted context string', () => {
            const results = service.search({
                query: 'technology stack frontend backend',
                agentRole: 'architect',
            });
            const context = service.assembleContext(results);
            expect(context).toContain('Institutional Memory');
            expect(context).toContain('BINDING');
        });

        it('should handle empty results gracefully', () => {
            const emptyResult = {
                chunks: [],
                query: 'nonexistent topic xyz',
                totalMatches: 0,
                searchDurationMs: 1,
            };
            const context = service.assembleContext(emptyResult);
            expect(context).toContain('No relevant precedents');
        });
    });

    describe('Stats', () => {
        it('should return accurate knowledge base statistics', () => {
            const stats = service.getStats();
            expect(stats.totalChunks).toBeGreaterThan(0);
            expect(stats.bySourceType['constitution']).toBeGreaterThan(0);
            expect(stats.bySourceType['adr']).toBeGreaterThan(0);
        });
    });
});
