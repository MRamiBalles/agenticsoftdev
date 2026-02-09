/**
 * Spec Drift Detector Tests
 * 
 * Covers: versioning, drift detection, alignment, task gating, callbacks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpecDriftDetector } from '../../src/orchestrator/spec-drift-detector';

describe('SpecDriftDetector - Versioning', () => {
    let detector: SpecDriftDetector;

    beforeEach(() => {
        detector = new SpecDriftDetector();
    });

    it('should create initial spec version', () => {
        const v = detector.updateSpec('auth', '# Auth Spec\nLogin flow');
        expect(v).not.toBeNull();
        expect(v!.version).toBe(1);
        expect(v!.hash).toBeTruthy();
        expect(v!.sizeBytes).toBeGreaterThan(0);
    });

    it('should bump version on content change', () => {
        detector.updateSpec('auth', 'version 1 content');
        const v2 = detector.updateSpec('auth', 'version 2 content - changed');
        expect(v2).not.toBeNull();
        expect(v2!.version).toBe(2);
    });

    it('should return null when content is unchanged', () => {
        detector.updateSpec('auth', 'same content');
        const v2 = detector.updateSpec('auth', 'same content');
        expect(v2).toBeNull();
    });

    it('should track spec and plan independently', () => {
        detector.updateSpec('auth', 'spec v1');
        detector.updatePlan('auth', 'plan v1');
        const history = detector.getHistory('auth');
        expect(history.specs).toHaveLength(1);
        expect(history.plans).toHaveLength(1);
    });

    it('should maintain version history', () => {
        detector.updateSpec('auth', 'v1');
        detector.updateSpec('auth', 'v2');
        detector.updateSpec('auth', 'v3');
        const history = detector.getHistory('auth');
        expect(history.specs).toHaveLength(3);
        expect(history.specs[0].version).toBe(1);
        expect(history.specs[2].version).toBe(3);
    });
});

describe('SpecDriftDetector - Drift Detection', () => {
    let detector: SpecDriftDetector;

    beforeEach(() => {
        detector = new SpecDriftDetector();
    });

    it('should report aligned when both docs exist and plan is up to date', () => {
        detector.updatePlan('auth', 'plan v1');
        // Small delay to ensure spec timestamp is not after plan
        detector.updateSpec('auth', 'spec v1');
        detector.markAligned('auth');
        const drift = detector.checkDrift('auth');
        expect(drift.aligned).toBe(true);
        expect(drift.driftType).toBe('NONE');
    });

    it('should detect MISSING_PLAN', () => {
        detector.updateSpec('auth', 'spec content');
        const drift = detector.checkDrift('auth');
        expect(drift.aligned).toBe(false);
        expect(drift.driftType).toBe('MISSING_PLAN');
    });

    it('should detect MISSING_SPEC', () => {
        detector.updatePlan('auth', 'plan content');
        const drift = detector.checkDrift('auth');
        expect(drift.aligned).toBe(false);
        expect(drift.driftType).toBe('MISSING_SPEC');
    });

    it('should detect SPEC_AHEAD when spec updated after plan', () => {
        detector.updatePlan('auth', 'plan v1');
        detector.updateSpec('auth', 'spec v1');
        detector.markAligned('auth');
        // Now update spec without updating plan
        detector.updateSpec('auth', 'spec v2 - requirements changed');
        const drift = detector.checkDrift('auth');
        expect(drift.aligned).toBe(false);
        expect(drift.driftType).toBe('SPEC_AHEAD');
    });

    it('should report no documents as aligned', () => {
        const drift = detector.checkDrift('nonexistent');
        expect(drift.aligned).toBe(true);
        expect(drift.driftType).toBe('NONE');
    });

    it('should list all features with drift status', () => {
        detector.updateSpec('auth', 'spec');
        detector.updatePlan('auth', 'plan');
        detector.updateSpec('payments', 'spec');

        const all = detector.getAllDriftStatus();
        expect(all).toHaveLength(2);
        expect(all.some(d => d.featureId === 'auth')).toBe(true);
        expect(all.some(d => d.featureId === 'payments')).toBe(true);
    });
});

describe('SpecDriftDetector - Alignment', () => {
    it('should reset drift after markAligned + plan update', () => {
        const detector = new SpecDriftDetector();
        detector.updateSpec('auth', 'spec v1');
        detector.updatePlan('auth', 'plan v1');
        detector.markAligned('auth');

        detector.updateSpec('auth', 'spec v2');
        expect(detector.checkDrift('auth').aligned).toBe(false);

        // Update plan to match new spec
        detector.updatePlan('auth', 'plan v2 reflecting spec v2');
        detector.markAligned('auth');
        expect(detector.checkDrift('auth').aligned).toBe(true);
    });
});

describe('SpecDriftDetector - Task Gate', () => {
    let detector: SpecDriftDetector;

    beforeEach(() => {
        detector = new SpecDriftDetector();
    });

    it('should allow tasks when aligned', () => {
        detector.updateSpec('auth', 'spec');
        detector.updatePlan('auth', 'plan');
        detector.markAligned('auth');

        expect(detector.checkTaskGate('auth', 'CODE').allowed).toBe(true);
        expect(detector.checkTaskGate('auth', 'DEPLOY').allowed).toBe(true);
    });

    it('should block CODE when spec drifted ahead', () => {
        detector.updatePlan('auth', 'plan v1');
        detector.updateSpec('auth', 'spec v1');
        detector.markAligned('auth');
        detector.updateSpec('auth', 'spec v2 - new requirements');

        const gate = detector.checkTaskGate('auth', 'CODE');
        expect(gate.allowed).toBe(false);
        expect(gate.reason).toContain('drift');
    });

    it('should block CODE when plan is missing', () => {
        detector.updateSpec('auth', 'spec');

        const gate = detector.checkTaskGate('auth', 'CODE');
        expect(gate.allowed).toBe(false);
        expect(gate.reason).toContain('No plan');
    });

    it('should allow PLAN tasks even when drifted (need to update plan)', () => {
        detector.updateSpec('auth', 'spec v1');
        // No plan yet
        const gate = detector.checkTaskGate('auth', 'PLAN');
        expect(gate.allowed).toBe(true);
    });

    it('should allow all tasks when blocking is disabled', () => {
        const permissive = new SpecDriftDetector({ blockOnDrift: false });
        permissive.updateSpec('auth', 'spec');
        // No plan

        expect(permissive.checkTaskGate('auth', 'CODE').allowed).toBe(true);
        expect(permissive.checkTaskGate('auth', 'DEPLOY').allowed).toBe(true);
    });
});

describe('SpecDriftDetector - Callbacks', () => {
    it('should fire onVersionBumped', () => {
        const onBump = vi.fn();
        const detector = new SpecDriftDetector({}, { onVersionBumped: onBump });

        detector.updateSpec('auth', 'content');
        expect(onBump).toHaveBeenCalledWith('auth', 'spec', expect.objectContaining({ version: 1 }));
    });

    it('should fire onDriftDetected when spec has no plan', () => {
        const onDrift = vi.fn();
        const detector = new SpecDriftDetector({}, { onDriftDetected: onDrift });

        detector.updateSpec('auth', 'spec without plan');
        expect(onDrift).toHaveBeenCalledTimes(1);
        expect(onDrift).toHaveBeenCalledWith(expect.objectContaining({
            featureId: 'auth',
            severity: 'CRITICAL',
        }));
    });

    it('should fire onAligned', () => {
        const onAligned = vi.fn();
        const detector = new SpecDriftDetector({}, { onAligned });

        detector.updateSpec('auth', 'spec');
        detector.updatePlan('auth', 'plan');
        detector.markAligned('auth');

        expect(onAligned).toHaveBeenCalledWith('auth');
    });

    it('should not fire onDriftDetected for unchanged content', () => {
        const onDrift = vi.fn();
        const detector = new SpecDriftDetector({}, { onDriftDetected: onDrift });

        detector.updateSpec('auth', 'content');
        onDrift.mockClear();
        detector.updateSpec('auth', 'content'); // same content
        expect(onDrift).not.toHaveBeenCalled();
    });
});
