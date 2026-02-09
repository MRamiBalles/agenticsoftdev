/**
 * Planning Gate: Mandatory Pre-Plan Consultation
 * 
 * Implements the "Look-Before-You-Leap" rule:
 *   Before any PLAN task, the agent MUST query institutional memory
 *   for relevant constraints, precedents, and contradictions.
 * 
 * If the gate detects a contradiction between the proposed action
 * and retrieved precedents, it triggers an INTERRUPT requiring
 * human clarification.
 * 
 * Phase 3.1: Protocolo Mnemosyne
 * Compliance: constitution.md Art. II.3 (Spec-Driven Execution)
 */

import { RetrievalService, RetrievalQuery, RetrievalResult } from './retrieval-service';
import type { AgentRole } from '../security-gate';
import type { Domain } from './semantic-chunker';

// ─── Types ───

export type GateDecision = 'PROCEED' | 'PROCEED_WITH_CONTEXT' | 'INTERRUPT' | 'BLOCK';

export interface PlanningGateResult {
    decision: GateDecision;
    reason: string;
    retrievedContext: string;
    precedents: RetrievalResult;
    contradictions: Contradiction[];
    mandatoryConstraints: string[];
}

export interface Contradiction {
    /** The proposed element that conflicts */
    proposed: string;
    /** The existing precedent that contradicts it */
    precedent: string;
    /** Source of the precedent */
    source: string;
    /** Severity of the contradiction */
    severity: 'critical' | 'warning';
}

export interface PlanningGateConfig {
    /** Minimum number of precedents to retrieve before proceeding */
    minPrecedents: number;
    /** Similarity threshold for retrieval */
    similarityThreshold: number;
    /** Maximum results to retrieve */
    topK: number;
    /** Whether to block on contradictions or just warn */
    blockOnContradictions: boolean;
}

const DEFAULT_CONFIG: PlanningGateConfig = {
    minPrecedents: 1,
    similarityThreshold: 0.25,
    topK: 8,
    blockOnContradictions: true,
};

// ─── Contradiction Detection Keywords ───

const TECHNOLOGY_PATTERNS: { pattern: RegExp; label: string; domain: Domain }[] = [
    { pattern: /\b(mongodb|mongo)\b/i, label: 'MongoDB', domain: 'persistence' },
    { pattern: /\b(postgresql|postgres|supabase)\b/i, label: 'PostgreSQL/Supabase', domain: 'persistence' },
    { pattern: /\b(redis)\b/i, label: 'Redis', domain: 'persistence' },
    { pattern: /\b(mysql)\b/i, label: 'MySQL', domain: 'persistence' },
    { pattern: /\b(firebase)\b/i, label: 'Firebase', domain: 'persistence' },
    { pattern: /\b(angular)\b/i, label: 'Angular', domain: 'frontend' },
    { pattern: /\b(vue)\b/i, label: 'Vue', domain: 'frontend' },
    { pattern: /\b(next\.?js|nextjs)\b/i, label: 'Next.js', domain: 'frontend' },
    { pattern: /\bnew\b.*\b(update|tick|loop)\b/i, label: 'Allocation in hot path', domain: 'architecture' },
    { pattern: /\beval\s*\(/i, label: 'eval()', domain: 'security' },
];

// ─── Planning Gate Implementation ───

export class PlanningGate {
    private retrieval: RetrievalService;
    private config: PlanningGateConfig;

    constructor(retrieval: RetrievalService, config?: Partial<PlanningGateConfig>) {
        this.retrieval = retrieval;
        this.config = { ...DEFAULT_CONFIG, ...config };

        console.log('🚪 Planning Gate armed (Look-Before-You-Leap).');
    }

    /**
     * Evaluates a proposed task against institutional memory.
     * 
     * @param taskDescription - Natural language description of the proposed task
     * @param agentRole - Role of the agent proposing the task
     * @param proposedTechnologies - Optional list of technologies/patterns being proposed
     */
    public evaluate(params: {
        taskDescription: string;
        agentRole: AgentRole;
        proposedTechnologies?: string[];
        taskDomain?: Domain;
    }): PlanningGateResult {
        const { taskDescription, agentRole, proposedTechnologies, taskDomain } = params;

        console.log(`🚪 Planning Gate: Evaluating task for agent [${agentRole}]`);
        console.log(`   Task: "${taskDescription.slice(0, 80)}..."`);

        // Step 1: Retrieve relevant precedents
        const query: RetrievalQuery = {
            query: taskDescription,
            agentRole,
            domain: taskDomain,
            threshold: this.config.similarityThreshold,
            topK: this.config.topK,
        };

        const precedents = this.retrieval.search(query);

        // Step 2: Extract mandatory constraints from retrieved chunks
        const mandatoryConstraints = this.extractMandatoryConstraints(precedents);

        // Step 3: Detect contradictions
        const contradictions = this.detectContradictions(
            taskDescription,
            proposedTechnologies ?? [],
            precedents,
        );

        // Step 4: Assemble context for the agent
        const retrievedContext = this.retrieval.assembleContext(precedents);

        // Step 5: Make gate decision
        const decision = this.makeDecision(precedents, contradictions, mandatoryConstraints);

        console.log(`🚪 Gate Decision: ${decision.decision} — ${decision.reason}`);
        if (contradictions.length > 0) {
            console.warn(`   ⚠️ ${contradictions.length} contradiction(s) detected`);
        }

        return {
            ...decision,
            retrievedContext,
            precedents,
            contradictions,
            mandatoryConstraints,
        };
    }

    /**
     * Quick check: extracts keywords from a task payload and runs a
     * mandatory constitutional consultation. Used by the orchestrator
     * before dispatching PLAN tasks.
     */
    public quickConsult(taskPayload: Record<string, unknown>, agentRole: AgentRole): PlanningGateResult {
        // Extract keywords from payload
        const keywords = this.extractKeywords(taskPayload);
        const description = keywords.join(' ');

        // Detect any technology mentions
        const technologies = this.detectTechnologies(description);

        return this.evaluate({
            taskDescription: description,
            agentRole,
            proposedTechnologies: technologies,
        });
    }

    // ─── Contradiction Detection ───

    private detectContradictions(
        taskDescription: string,
        proposedTech: string[],
        precedents: RetrievalResult,
    ): Contradiction[] {
        const contradictions: Contradiction[] = [];
        const combinedText = `${taskDescription} ${proposedTech.join(' ')}`.toLowerCase();

        // Check each technology pattern against precedents
        for (const techPattern of TECHNOLOGY_PATTERNS) {
            if (!techPattern.pattern.test(combinedText)) continue;

            // Check if any precedent contradicts this technology
            for (const chunk of precedents.chunks) {
                const chunkLower = chunk.content.toLowerCase();

                // Check for explicit prohibition
                if (this.isProhibited(chunkLower, techPattern.label)) {
                    contradictions.push({
                        proposed: techPattern.label,
                        precedent: chunk.content.slice(0, 200),
                        source: chunk.source_file,
                        severity: chunk.impact === 'critical' ? 'critical' : 'warning',
                    });
                }

                // Check for alternative mandate (e.g., "use PostgreSQL" when proposing MongoDB)
                if (this.hasAlternativeMandate(chunkLower, techPattern)) {
                    contradictions.push({
                        proposed: `${techPattern.label} (conflicts with mandated alternative)`,
                        precedent: chunk.content.slice(0, 200),
                        source: chunk.source_file,
                        severity: 'critical',
                    });
                }
            }
        }

        return contradictions;
    }

    private isProhibited(text: string, technology: string): boolean {
        const techLower = technology.toLowerCase();
        const prohibitionPatterns = [
            `${techLower} is prohibited`,
            `${techLower} is forbidden`,
            `do not use ${techLower}`,
            `avoid ${techLower}`,
            `prohibited.*${techLower}`,
            `forbidden.*${techLower}`,
        ];

        return prohibitionPatterns.some(p => new RegExp(p, 'i').test(text));
    }

    private hasAlternativeMandate(chunkText: string, proposed: { label: string; domain: Domain }): boolean {
        // Look for mandates in the same domain that specify a different technology
        const mandatePatterns = [/must use\s+(\w+)/gi, /exclusively\s+(\w+)/gi, /standard.*is\s+(\w+)/gi, /adherence.*(\w+)/gi];

        for (const pattern of mandatePatterns) {
            let match;
            while ((match = pattern.exec(chunkText)) !== null) {
                const mandated = match[1].toLowerCase();
                if (mandated !== proposed.label.toLowerCase() && mandated.length > 3) {
                    // Found a mandate for a different technology in the same domain
                    return true;
                }
            }
        }

        return false;
    }

    // ─── Constraint Extraction ───

    private extractMandatoryConstraints(precedents: RetrievalResult): string[] {
        const constraints: string[] = [];

        for (const chunk of precedents.chunks) {
            if (chunk.impact === 'critical' || chunk.source_type === 'constitution') {
                // Extract bullet points that contain mandatory language
                const lines = chunk.content.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (/\b(must|shall|forbidden|prohibited|required|mandatory)\b/i.test(trimmed)) {
                        const clean = trimmed.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '');
                        if (clean.length > 20 && clean.length < 500) {
                            constraints.push(clean);
                        }
                    }
                }
            }
        }

        return [...new Set(constraints)]; // Deduplicate
    }

    // ─── Decision Logic ───

    private makeDecision(
        precedents: RetrievalResult,
        contradictions: Contradiction[],
        constraints: string[],
    ): { decision: GateDecision; reason: string } {
        // Critical contradictions → BLOCK or INTERRUPT
        const criticalContradictions = contradictions.filter(c => c.severity === 'critical');

        if (criticalContradictions.length > 0 && this.config.blockOnContradictions) {
            return {
                decision: 'INTERRUPT',
                reason: `${criticalContradictions.length} critical contradiction(s) with institutional memory. Human clarification required.`,
            };
        }

        // Has relevant context → inject it
        if (precedents.chunks.length > 0) {
            const warningCount = contradictions.filter(c => c.severity === 'warning').length;
            const constraintNote = constraints.length > 0 ? ` ${constraints.length} mandatory constraint(s) applied.` : '';
            const warningNote = warningCount > 0 ? ` ${warningCount} warning(s).` : '';

            return {
                decision: 'PROCEED_WITH_CONTEXT',
                reason: `${precedents.chunks.length} precedent(s) found.${constraintNote}${warningNote} Context injected into agent prompt.`,
            };
        }

        // No precedents found — proceed but note the gap
        return {
            decision: 'PROCEED',
            reason: 'No relevant precedents found. Agent proceeding without historical context.',
        };
    }

    // ─── Keyword Extraction ───

    private extractKeywords(payload: Record<string, unknown>): string[] {
        const keywords: string[] = [];

        const extract = (value: unknown): void => {
            if (typeof value === 'string') {
                keywords.push(value);
            } else if (Array.isArray(value)) {
                value.forEach(extract);
            } else if (typeof value === 'object' && value !== null) {
                Object.values(value).forEach(extract);
            }
        };

        extract(payload);
        return keywords;
    }

    private detectTechnologies(text: string): string[] {
        const detected: string[] = [];
        for (const tp of TECHNOLOGY_PATTERNS) {
            if (tp.pattern.test(text)) {
                detected.push(tp.label);
            }
        }
        return detected;
    }
}
