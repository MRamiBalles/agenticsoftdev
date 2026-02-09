/**
 * ATDI Quality Engine Tests
 * 
 * Covers: cycle detection, god component detection, per-file metrics,
 * traffic light classification, deploy gate, and callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    ATDIEngine,
    DependencyGraph,
    SourceMetrics,
    ATDIReport,
    ATDISmell,
} from '../../src/orchestrator/atdi-engine';

// ─── Helpers ───

function cleanGraph(): DependencyGraph {
    return {
        'app.ts': ['router.ts', 'db.ts'],
        'router.ts': ['handler.ts'],
        'handler.ts': ['db.ts'],
        'db.ts': [],
    };
}

function cyclicGraph(): DependencyGraph {
    return {
        'a.ts': ['b.ts'],
        'b.ts': ['c.ts'],
        'c.ts': ['a.ts'],
    };
}

function cleanMetrics(): SourceMetrics[] {
    return [
        { file: 'app.ts', loc: 100, complexity: 5, imports: ['router.ts', 'db.ts'] },
        { file: 'router.ts', loc: 50, complexity: 3, imports: ['handler.ts'] },
        { file: 'handler.ts', loc: 80, complexity: 8, imports: ['db.ts'] },
        { file: 'db.ts', loc: 60, complexity: 4, imports: [] },
    ];
}

function riskyMetrics(): SourceMetrics[] {
    return [
        { file: 'god.ts', loc: 500, complexity: 25, imports: Array.from({ length: 15 }, (_, i) => `dep${i}.ts`) },
        { file: 'small.ts', loc: 30, complexity: 2, imports: ['util.ts'] },
    ];
}

// ─── Cycle Detection ───

describe('ATDIEngine - Cycle Detection', () => {
    it('should detect no cycles in a clean graph', () => {
        const engine = new ATDIEngine();
        const cycles = engine.detectCycles(cleanGraph());
        expect(cycles).toHaveLength(0);
    });

    it('should detect a 3-node cycle', () => {
        const engine = new ATDIEngine();
        const cycles = engine.detectCycles(cyclicGraph());
        expect(cycles.length).toBeGreaterThanOrEqual(1);
        const cycle = cycles[0];
        expect(cycle).toContain('a.ts');
        expect(cycle).toContain('b.ts');
        expect(cycle).toContain('c.ts');
    });

    it('should detect multiple cycles', () => {
        const engine = new ATDIEngine();
        const graph: DependencyGraph = {
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
            'c.ts': ['d.ts'],
            'd.ts': ['c.ts'],
        };
        const cycles = engine.detectCycles(graph);
        expect(cycles.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle self-referencing node', () => {
        const engine = new ATDIEngine();
        const graph: DependencyGraph = { 'a.ts': ['a.ts'] };
        const cycles = engine.detectCycles(graph);
        expect(cycles.length).toBeGreaterThanOrEqual(1);
    });
});

// ─── Traffic Light Classification ───

describe('ATDIEngine - Traffic Light', () => {
    it('should classify GREEN for score < 5', () => {
        const engine = new ATDIEngine();
        expect(engine.classify(0)).toBe('GREEN');
        expect(engine.classify(4)).toBe('GREEN');
    });

    it('should classify AMBER for 5 <= score < 15', () => {
        const engine = new ATDIEngine();
        expect(engine.classify(5)).toBe('AMBER');
        expect(engine.classify(14)).toBe('AMBER');
    });

    it('should classify RED for score >= 15', () => {
        const engine = new ATDIEngine();
        expect(engine.classify(15)).toBe('RED');
        expect(engine.classify(100)).toBe('RED');
    });

    it('should respect custom thresholds', () => {
        const engine = new ATDIEngine({ greenMax: 10, amberMax: 50 });
        expect(engine.classify(9)).toBe('GREEN');
        expect(engine.classify(10)).toBe('AMBER');
        expect(engine.classify(49)).toBe('AMBER');
        expect(engine.classify(50)).toBe('RED');
    });
});

// ─── Full Analysis ───

describe('ATDIEngine - Analysis', () => {
    it('should produce GREEN report for clean codebase', () => {
        const engine = new ATDIEngine();
        const report = engine.analyze(cleanGraph(), cleanMetrics());

        expect(report.score).toBe(0);
        expect(report.trafficLight).toBe('GREEN');
        expect(report.smells).toHaveLength(0);
        expect(report.fileMetrics).toHaveLength(0);
        expect(report.blocked).toBe(false);
        expect(report.nodesCount).toBe(4);
    });

    it('should produce RED report for cyclic + high-debt codebase', () => {
        const engine = new ATDIEngine();
        const report = engine.analyze(cyclicGraph(), riskyMetrics());

        expect(report.score).toBeGreaterThan(0);
        expect(report.smells.some(s => s.type === 'CYCLE')).toBe(true);
        expect(report.fileMetrics.some(f => f.file === 'god.ts')).toBe(true);

        // god.ts: LOC 500 > 300 = +200, complexity 25 > 15 = +50, deps 15 > 10 = +10 → 260
        // Plus cycle penalty = 10 * 3 = 30
        // Total = 290 → RED
        expect(report.trafficLight).toBe('RED');
        expect(report.blocked).toBe(true);
        expect(report.blockReason).toContain('RED');
    });

    it('should calculate per-file metrics correctly', () => {
        const engine = new ATDIEngine();
        const metrics: SourceMetrics[] = [
            { file: 'big.ts', loc: 350, complexity: 20, imports: Array.from({ length: 12 }, (_, i) => `d${i}`) },
        ];
        const report = engine.analyze({}, metrics);

        const fm = report.fileMetrics[0];
        expect(fm.file).toBe('big.ts');
        // LOC: (350-300)*1 = 50
        expect(fm.reasons.some(r => r.includes('LOC'))).toBe(true);
        // Complexity: (20-15)*5 = 25
        expect(fm.reasons.some(r => r.includes('Complexity'))).toBe(true);
        // Deps: (12-10)*2 = 4
        expect(fm.reasons.some(r => r.includes('Deps'))).toBe(true);
        expect(fm.atdiContribution).toBe(50 + 25 + 4);
    });

    it('should fire callbacks on analysis', () => {
        const onComplete = vi.fn();
        const onBlocked = vi.fn();
        const onSmell = vi.fn();

        const engine = new ATDIEngine({}, {}, {
            onAnalysisComplete: onComplete,
            onDeployBlocked: onBlocked,
            onSmellDetected: onSmell,
        });

        engine.analyze(cyclicGraph(), riskyMetrics());

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onBlocked).toHaveBeenCalledTimes(1);
        expect(onSmell).toHaveBeenCalled();
    });

    it('should not fire onDeployBlocked for GREEN report', () => {
        const onBlocked = vi.fn();
        const engine = new ATDIEngine({}, {}, { onDeployBlocked: onBlocked });

        engine.analyze(cleanGraph(), cleanMetrics());
        expect(onBlocked).not.toHaveBeenCalled();
    });
});

// ─── Deploy Gate ───

describe('ATDIEngine - Deploy Gate', () => {
    it('should allow deploy when no analysis has run', () => {
        const engine = new ATDIEngine();
        const gate = engine.checkDeployGate();
        expect(gate.allowed).toBe(true);
        expect(gate.trafficLight).toBe('GREEN');
    });

    it('should allow deploy for GREEN', () => {
        const engine = new ATDIEngine();
        engine.analyze(cleanGraph(), cleanMetrics());

        const gate = engine.checkDeployGate();
        expect(gate.allowed).toBe(true);
        expect(gate.trafficLight).toBe('GREEN');
    });

    it('should allow deploy with warning for AMBER', () => {
        // Force AMBER: score between 5 and 15
        const engine = new ATDIEngine();
        const metrics: SourceMetrics[] = [
            { file: 'medium.ts', loc: 310, complexity: 16, imports: Array.from({ length: 5 }, () => 'x') },
        ];
        // LOC: (310-300)*1 = 10, Complexity: (16-15)*5 = 5 → total = 15 → that's RED
        // Adjust to get AMBER: score 5-14
        const amberMetrics: SourceMetrics[] = [
            { file: 'medium.ts', loc: 305, complexity: 16, imports: [] },
        ];
        // LOC: 5*1=5, Complexity: 1*5=5 → total = 10 → AMBER
        engine.analyze({}, amberMetrics);

        const gate = engine.checkDeployGate();
        expect(gate.allowed).toBe(true);
        expect(gate.trafficLight).toBe('AMBER');
        expect(gate.reason).toContain('warning');
    });

    it('should block deploy for RED', () => {
        const engine = new ATDIEngine();
        engine.analyze(cyclicGraph(), riskyMetrics());

        const gate = engine.checkDeployGate();
        expect(gate.allowed).toBe(false);
        expect(gate.trafficLight).toBe('RED');
        expect(gate.reason).toContain('BLOCKED');
    });
});

// ─── God Component Detection ───

describe('ATDIEngine - God Component', () => {
    it('should detect hub nodes with excessive edges', () => {
        const engine = new ATDIEngine({ dependencyLimit: 3 });
        const graph: DependencyGraph = {
            'hub.ts': ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
            'a.ts': ['hub.ts'],
            'b.ts': ['hub.ts'],
            'c.ts': ['hub.ts'],
            'd.ts': ['hub.ts'],
            'e.ts': ['hub.ts'],
        };

        const report = engine.analyze(graph, []);
        const gods = report.smells.filter(s => s.type === 'GOD_COMPONENT');
        expect(gods.length).toBeGreaterThan(0);
        expect(gods.some(g => g.files.includes('hub.ts'))).toBe(true);
    });
});

// ─── Last Report ───

describe('ATDIEngine - Report Persistence', () => {
    it('should store and return last report', () => {
        const engine = new ATDIEngine();
        expect(engine.getLastReport()).toBeNull();

        engine.analyze(cleanGraph(), cleanMetrics());
        const report = engine.getLastReport();
        expect(report).not.toBeNull();
        expect(report!.timestamp).toBeGreaterThan(0);
    });
});
