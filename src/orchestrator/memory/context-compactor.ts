/**
 * Context Compactor: Session Summarization & Memory Hygiene
 * 
 * After a planning/coding session concludes, compacts the session
 * into a high-signal knowledge summary and stores it in the vector DB.
 * This prevents "context rot" by maintaining signal density.
 * 
 * Phase 3.1: Protocolo Mnemosyne
 */

import * as crypto from 'crypto';
import { KnowledgeChunk } from './semantic-chunker';
import { generateLocalEmbedding } from './ingest-pipeline';
import { RetrievalService } from './retrieval-service';
import type { AgentRole } from '../security-gate';

// ─── Types ───

export interface SessionEvent {
    timestamp: string;
    agent: string;
    action: string;
    detail: string;
}

export interface CompactionResult {
    summary: KnowledgeChunk & { embedding: number[] };
    eventsProcessed: number;
    keyDecisions: string[];
}

// ─── Compactor Implementation ───

export class ContextCompactor {
    private retrieval: RetrievalService;

    constructor(retrieval: RetrievalService) {
        this.retrieval = retrieval;
        console.log('🗜️ Context Compactor initialized.');
    }

    /**
     * Compacts a session's events into a single knowledge summary chunk.
     * Extracts key decisions and learnings, discarding noise.
     */
    public compact(params: {
        sessionId: string;
        events: SessionEvent[];
        writerRole: AgentRole;
    }): CompactionResult | null {
        const { sessionId, events, writerRole } = params;

        if (events.length === 0) {
            console.log('🗜️ No events to compact.');
            return null;
        }

        console.log(`🗜️ Compacting session ${sessionId.slice(0, 8)}... (${events.length} events)`);

        // Extract significant events (filter noise)
        const significant = events.filter(e => this.isSignificant(e));
        const keyDecisions = this.extractKeyDecisions(significant);

        // Build summary text
        const summaryText = this.buildSummary(sessionId, significant, keyDecisions);

        // Create knowledge chunk
        const embedding = generateLocalEmbedding(summaryText);
        const chunk: KnowledgeChunk & { embedding: number[] } = {
            content: summaryText,
            source_type: 'session_summary',
            source_file: `sessions/${sessionId.slice(0, 8)}.md`,
            source_hash: crypto.createHash('sha256').update(summaryText).digest('hex'),
            chunk_index: 0,
            domain: this.detectPrimaryDomain(significant),
            status: 'active',
            impact: 'standard',
            constitutional_ref: null,
            tags: ['session_summary', ...keyDecisions.map(() => 'decision')],
            embedding,
        };

        // Ingest into retrieval service
        const ingested = this.retrieval.ingestChunks([chunk], writerRole);
        if (ingested === 0) {
            console.warn('⚠️ Compaction failed: RBAC denied write access.');
            return null;
        }

        console.log(`🗜️ Session compacted: ${keyDecisions.length} key decisions preserved.`);

        return {
            summary: chunk,
            eventsProcessed: events.length,
            keyDecisions,
        };
    }

    // ─── Internal Logic ───

    private isSignificant(event: SessionEvent): boolean {
        const significantActions = [
            'PLAN_DECISION',
            'FILE_WRITE',
            'BLOCKED',
            'FAILURE',
            'COMPLETED',
        ];
        return significantActions.includes(event.action);
    }

    private extractKeyDecisions(events: SessionEvent[]): string[] {
        const decisions: string[] = [];

        for (const event of events) {
            if (event.action === 'PLAN_DECISION') {
                decisions.push(`[DECISION] ${event.detail}`);
            } else if (event.action === 'BLOCKED') {
                decisions.push(`[BLOCKED] ${event.agent}: ${event.detail}`);
            } else if (event.action === 'FAILURE') {
                decisions.push(`[LESSON] ${event.agent} failed: ${event.detail}`);
            }
        }

        return decisions;
    }

    private buildSummary(sessionId: string, events: SessionEvent[], decisions: string[]): string {
        const lines: string[] = [
            `# Session Summary: ${sessionId.slice(0, 8)}`,
            `**Date:** ${new Date().toISOString().split('T')[0]}`,
            `**Events:** ${events.length}`,
            '',
            '## Key Decisions & Learnings',
        ];

        if (decisions.length === 0) {
            lines.push('No significant decisions recorded in this session.');
        } else {
            for (const d of decisions) {
                lines.push(`- ${d}`);
            }
        }

        lines.push('');
        lines.push('## Activity Log');

        for (const event of events.slice(0, 20)) { // Cap at 20 to avoid bloat
            lines.push(`- [${event.action}] ${event.agent}: ${event.detail.slice(0, 150)}`);
        }

        if (events.length > 20) {
            lines.push(`- ... and ${events.length - 20} more events`);
        }

        return lines.join('\n');
    }

    private detectPrimaryDomain(events: SessionEvent[]): KnowledgeChunk['domain'] {
        const domainKeywords: Record<string, string[]> = {
            security: ['security', 'secret', 'firewall', 'injection'],
            architecture: ['structure', 'dependency', 'atdi', 'smell'],
            governance: ['constitution', 'raci', 'audit', 'compliance'],
            persistence: ['database', 'migration', 'sql', 'supabase'],
            frontend: ['component', 'ui', 'react', 'dashboard'],
        };

        const allText = events.map(e => e.detail).join(' ').toLowerCase();
        let bestDomain: KnowledgeChunk['domain'] = 'general';
        let bestScore = 0;

        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            const score = keywords.filter(kw => allText.includes(kw)).length;
            if (score > bestScore) {
                bestScore = score;
                bestDomain = domain as KnowledgeChunk['domain'];
            }
        }

        return bestDomain;
    }
}
