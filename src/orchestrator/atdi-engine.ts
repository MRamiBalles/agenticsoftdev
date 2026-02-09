/**
 * ATDI Quality Engine — Architectural Technical Debt Index
 * 
 * Programmatic debt analysis for the orchestrator pipeline:
 *   - Dependency graph analysis (cycles, god components)
 *   - Complexity scoring (LOC, cyclomatic, import count)
 *   - Governance gate: GREEN / AMBER / RED traffic light
 *   - Integrates into dispatch pipeline as pre-deploy gate
 * 
 * Phase 5: Quality Engine Integration
 * Compliance: constitution.md Art. III (Structural Integrity),
 *             spec_atdi.md §2.3 (ATDI Calculation), §2.4 (Governance Gate)
 */

// ─── Types ───

export type ATDISmellType = 'CYCLE' | 'GOD_COMPONENT' | 'HIGH_COMPLEXITY' | 'HIGH_LOC' | 'HIGH_DEPENDENCIES';

export type ATDITrafficLight = 'GREEN' | 'AMBER' | 'RED';

export interface ATDISmell {
    type: ATDISmellType;
    severity: number;
    description: string;
    files: string[];
}

export interface FileMetrics {
    file: string;
    loc: number;
    complexity: number;
    dependencies: number;
    atdiContribution: number;
    reasons: string[];
}

export interface ATDIReport {
    score: number;
    trafficLight: ATDITrafficLight;
    smells: ATDISmell[];
    fileMetrics: FileMetrics[];
    nodesCount: number;
    edgesCount: number;
    timestamp: number;
    blocked: boolean;
    blockReason?: string;
}

export interface ATDIThresholds {
    greenMax: number;
    amberMax: number;
    locLimit: number;
    complexityLimit: number;
    dependencyLimit: number;
}

export interface ATDISeverity {
    cycle: number;
    godComponent: number;
    locPerLine: number;
    complexityPerUnit: number;
    dependencyPerUnit: number;
}

export interface ATDICallbacks {
    onAnalysisComplete?: (report: ATDIReport) => void;
    onDeployBlocked?: (report: ATDIReport) => void;
    onSmellDetected?: (smell: ATDISmell) => void;
}

/** Simplified dependency graph: file → list of imports */
export type DependencyGraph = Record<string, string[]>;

/** Per-file source metrics (provided by external scanner) */
export interface SourceMetrics {
    file: string;
    loc: number;
    complexity: number;
    imports: string[];
}

// ─── Defaults ───

const DEFAULT_THRESHOLDS: ATDIThresholds = {
    greenMax: 5,
    amberMax: 15,
    locLimit: 300,
    complexityLimit: 15,
    dependencyLimit: 10,
};

const DEFAULT_SEVERITY: ATDISeverity = {
    cycle: 10,
    godComponent: 5,
    locPerLine: 1,
    complexityPerUnit: 5,
    dependencyPerUnit: 2,
};

// ─── ATDIEngine ───

export class ATDIEngine {
    private thresholds: ATDIThresholds;
    private severity: ATDISeverity;
    private callbacks: ATDICallbacks;
    private lastReport: ATDIReport | null = null;

    constructor(
        thresholds?: Partial<ATDIThresholds>,
        severity?: Partial<ATDISeverity>,
        callbacks?: ATDICallbacks,
    ) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        this.severity = { ...DEFAULT_SEVERITY, ...severity };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Run full ATDI analysis on a dependency graph + source metrics.
     * Returns a structured report with traffic light status.
     */
    public analyze(graph: DependencyGraph, metrics: SourceMetrics[]): ATDIReport {
        const smells: ATDISmell[] = [];
        const fileMetrics: FileMetrics[] = [];
        let score = 0;

        // 1. Detect cycles
        const cycles = this.detectCycles(graph);
        for (const cycle of cycles) {
            const cycleSeverity = this.severity.cycle * cycle.length;
            score += cycleSeverity;
            const smell: ATDISmell = {
                type: 'CYCLE',
                severity: cycleSeverity,
                description: `Circular dependency: ${cycle.join(' → ')}`,
                files: cycle,
            };
            smells.push(smell);
            this.callbacks.onSmellDetected?.(smell);
        }

        // 2. Detect god components
        const nodesCount = Object.keys(graph).length;
        let edgesCount = 0;
        for (const file of Object.keys(graph)) {
            const deps = graph[file];
            edgesCount += deps.length;

            // Count incoming edges
            const incoming = Object.values(graph).filter(d => d.includes(file)).length;
            const total = deps.length + incoming;
            if (total > this.thresholds.dependencyLimit * 2) {
                const smell: ATDISmell = {
                    type: 'GOD_COMPONENT',
                    severity: this.severity.godComponent,
                    description: `God component: ${file} (${deps.length} out + ${incoming} in = ${total} edges)`,
                    files: [file],
                };
                score += this.severity.godComponent;
                smells.push(smell);
                this.callbacks.onSmellDetected?.(smell);
            }
        }

        // 3. Per-file metrics analysis
        for (const m of metrics) {
            let contrib = 0;
            const reasons: string[] = [];

            if (m.loc > this.thresholds.locLimit) {
                const penalty = (m.loc - this.thresholds.locLimit) * this.severity.locPerLine;
                contrib += penalty;
                reasons.push(`LOC ${m.loc} > ${this.thresholds.locLimit} (+${penalty})`);
            }

            if (m.complexity > this.thresholds.complexityLimit) {
                const penalty = (m.complexity - this.thresholds.complexityLimit) * this.severity.complexityPerUnit;
                contrib += penalty;
                reasons.push(`Complexity ${m.complexity} > ${this.thresholds.complexityLimit} (+${penalty})`);
            }

            if (m.imports.length > this.thresholds.dependencyLimit) {
                const penalty = (m.imports.length - this.thresholds.dependencyLimit) * this.severity.dependencyPerUnit;
                contrib += penalty;
                reasons.push(`Deps ${m.imports.length} > ${this.thresholds.dependencyLimit} (+${penalty})`);
            }

            if (contrib > 0) {
                score += contrib;
                fileMetrics.push({
                    file: m.file,
                    loc: m.loc,
                    complexity: m.complexity,
                    dependencies: m.imports.length,
                    atdiContribution: contrib,
                    reasons,
                });
            }
        }

        // 4. Determine traffic light
        const trafficLight = this.classify(score);
        const blocked = trafficLight === 'RED';

        const report: ATDIReport = {
            score,
            trafficLight,
            smells,
            fileMetrics,
            nodesCount,
            edgesCount,
            timestamp: Date.now(),
            blocked,
            blockReason: blocked ? `ATDI score ${score} >= ${this.thresholds.amberMax} (RED). Deployment blocked.` : undefined,
        };

        this.lastReport = report;
        this.callbacks.onAnalysisComplete?.(report);

        if (blocked) {
            this.callbacks.onDeployBlocked?.(report);
        }

        return report;
    }

    /**
     * Check if a deploy task should be allowed based on last ATDI report.
     * Returns { allowed, reason, trafficLight, score }.
     */
    public checkDeployGate(): { allowed: boolean; reason: string; trafficLight: ATDITrafficLight; score: number } {
        if (!this.lastReport) {
            return { allowed: true, reason: 'No ATDI analysis available — allowing deploy', trafficLight: 'GREEN', score: 0 };
        }

        const r = this.lastReport;
        if (r.trafficLight === 'GREEN') {
            return { allowed: true, reason: `ATDI score ${r.score} (GREEN). Deploy allowed.`, trafficLight: 'GREEN', score: r.score };
        }
        if (r.trafficLight === 'AMBER') {
            return { allowed: true, reason: `ATDI score ${r.score} (AMBER). Deploy allowed with warning — justification required.`, trafficLight: 'AMBER', score: r.score };
        }
        return { allowed: false, reason: `ATDI score ${r.score} (RED). Deploy BLOCKED — requires exception signature.`, trafficLight: 'RED', score: r.score };
    }

    /**
     * Classify an ATDI score into traffic light.
     */
    public classify(score: number): ATDITrafficLight {
        if (score < this.thresholds.greenMax) return 'GREEN';
        if (score < this.thresholds.amberMax) return 'AMBER';
        return 'RED';
    }

    /**
     * Get the last analysis report (if any).
     */
    public getLastReport(): ATDIReport | null {
        return this.lastReport;
    }

    /**
     * Detect circular dependencies using iterative DFS.
     * Returns array of cycles (each cycle is array of file names).
     */
    public detectCycles(graph: DependencyGraph): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const inStack = new Set<string>();
        const path: string[] = [];

        const nodes = Object.keys(graph);

        for (const start of nodes) {
            if (visited.has(start)) continue;

            // Iterative DFS
            const stack: { node: string; index: number }[] = [{ node: start, index: 0 }];
            path.length = 0;

            while (stack.length > 0) {
                const frame = stack[stack.length - 1];
                const { node } = frame;

                if (frame.index === 0) {
                    if (visited.has(node) && !inStack.has(node)) {
                        stack.pop();
                        continue;
                    }
                    visited.add(node);
                    inStack.add(node);
                    path.push(node);
                }

                const neighbors = graph[node] ?? [];
                let pushed = false;

                while (frame.index < neighbors.length) {
                    const neighbor = neighbors[frame.index];
                    frame.index++;

                    if (inStack.has(neighbor)) {
                        // Found cycle
                        const cycleStart = path.indexOf(neighbor);
                        if (cycleStart !== -1) {
                            cycles.push([...path.slice(cycleStart)]);
                        }
                    } else if (!visited.has(neighbor) && graph[neighbor] !== undefined) {
                        stack.push({ node: neighbor, index: 0 });
                        pushed = true;
                        break;
                    }
                }

                if (!pushed) {
                    stack.pop();
                    path.pop();
                    inStack.delete(node);
                }
            }
        }

        return cycles;
    }
}
