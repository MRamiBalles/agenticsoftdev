/**
 * Spec Drift Detector — Versioned SDD Pipeline Guard
 * 
 * Tracks spec and plan document versions via content hashing.
 * Detects drift when a spec changes but the corresponding plan
 * hasn't been updated, blocking implementation tasks until alignment.
 * 
 * Phase 6: Spec Versioning & Drift Detection
 * Compliance: constitution.md Art. III (No Vibe Coding),
 *             roadmap.md §Phase 6 (Close the SDD loop)
 */

import * as crypto from 'crypto';

// ─── Types ───

export interface DocumentVersion {
    path: string;
    hash: string;
    version: number;
    updatedAt: number;
    sizeBytes: number;
}

export interface DriftStatus {
    featureId: string;
    specVersion: DocumentVersion | null;
    planVersion: DocumentVersion | null;
    aligned: boolean;
    driftType: 'NONE' | 'SPEC_AHEAD' | 'PLAN_AHEAD' | 'MISSING_SPEC' | 'MISSING_PLAN';
    driftDescription: string;
    specUpdatedAfterPlan: boolean;
}

export interface DriftAlert {
    featureId: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    timestamp: number;
}

export interface DriftDetectorCallbacks {
    onDriftDetected?: (alert: DriftAlert) => void;
    onVersionBumped?: (featureId: string, docType: 'spec' | 'plan', version: DocumentVersion) => void;
    onAligned?: (featureId: string) => void;
}

export interface SpecDriftConfig {
    /** Max allowed drift before blocking (in version bumps). Default: 1 */
    maxDriftVersions: number;
    /** Auto-block PLAN/CODE tasks when drift detected. Default: true */
    blockOnDrift: boolean;
}

// ─── Defaults ───

const DEFAULT_CONFIG: SpecDriftConfig = {
    maxDriftVersions: 1,
    blockOnDrift: true,
};

// ─── Helpers ───

function hashContent(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

// ─── SpecDriftDetector ───

export class SpecDriftDetector {
    private specs: Map<string, DocumentVersion[]> = new Map();
    private plans: Map<string, DocumentVersion[]> = new Map();
    /** Stores {specVersion, planVersion} at time of alignment */
    private alignmentSnapshots: Map<string, { specVersion: number; planVersion: number }> = new Map();
    private config: SpecDriftConfig;
    private callbacks: DriftDetectorCallbacks;

    constructor(config?: Partial<SpecDriftConfig>, callbacks?: DriftDetectorCallbacks) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.callbacks = callbacks ?? {};
    }

    /**
     * Register or update a spec document for a feature.
     * Returns the new version if content changed, null if unchanged.
     */
    public updateSpec(featureId: string, content: string, path?: string): DocumentVersion | null {
        return this.updateDocument('spec', featureId, content, path);
    }

    /**
     * Register or update a plan document for a feature.
     * Returns the new version if content changed, null if unchanged.
     */
    public updatePlan(featureId: string, content: string, path?: string): DocumentVersion | null {
        return this.updateDocument('plan', featureId, content, path);
    }

    /**
     * Check drift status for a feature.
     */
    public checkDrift(featureId: string): DriftStatus {
        const specVersions = this.specs.get(featureId);
        const planVersions = this.plans.get(featureId);

        const latestSpec = specVersions && specVersions.length > 0 ? specVersions[specVersions.length - 1] : null;
        const latestPlan = planVersions && planVersions.length > 0 ? planVersions[planVersions.length - 1] : null;

        if (!latestSpec && !latestPlan) {
            return {
                featureId,
                specVersion: null,
                planVersion: null,
                aligned: true,
                driftType: 'NONE',
                driftDescription: 'No documents registered',
                specUpdatedAfterPlan: false,
            };
        }

        if (!latestSpec) {
            return {
                featureId,
                specVersion: null,
                planVersion: latestPlan,
                aligned: false,
                driftType: 'MISSING_SPEC',
                driftDescription: `Plan exists (v${latestPlan!.version}) but no spec found`,
                specUpdatedAfterPlan: false,
            };
        }

        if (!latestPlan) {
            return {
                featureId,
                specVersion: latestSpec,
                planVersion: null,
                aligned: false,
                driftType: 'MISSING_PLAN',
                driftDescription: `Spec exists (v${latestSpec.version}) but no plan found`,
                specUpdatedAfterPlan: true,
            };
        }

        // Both exist — check alignment using version snapshots
        const snapshot = this.alignmentSnapshots.get(featureId);
        const specUpdatedAfterPlan = latestSpec.version > latestPlan.version ||
            (latestSpec.updatedAt > latestPlan.updatedAt);

        if (!snapshot) {
            // Never aligned — check if spec is ahead of plan by version ordering
            if (specUpdatedAfterPlan) {
                return {
                    featureId,
                    specVersion: latestSpec,
                    planVersion: latestPlan,
                    aligned: false,
                    driftType: 'SPEC_AHEAD',
                    driftDescription: `Spec (v${latestSpec.version}) updated after plan (v${latestPlan.version}). Never aligned.`,
                    specUpdatedAfterPlan: true,
                };
            }
            // Plan is same or newer — consider aligned
            return {
                featureId,
                specVersion: latestSpec,
                planVersion: latestPlan,
                aligned: true,
                driftType: 'NONE',
                driftDescription: `Aligned: spec v${latestSpec.version}, plan v${latestPlan.version}`,
                specUpdatedAfterPlan: false,
            };
        }

        // Have alignment snapshot — compare current versions to snapshot
        const specChanged = latestSpec.version > snapshot.specVersion;
        const planChanged = latestPlan.version > snapshot.planVersion;

        if (specChanged && !planChanged) {
            return {
                featureId,
                specVersion: latestSpec,
                planVersion: latestPlan,
                aligned: false,
                driftType: 'SPEC_AHEAD',
                driftDescription: `Spec bumped to v${latestSpec.version} (was v${snapshot.specVersion} at alignment), plan unchanged at v${latestPlan.version}`,
                specUpdatedAfterPlan: true,
            };
        }

        if (planChanged && !specChanged) {
            return {
                featureId,
                specVersion: latestSpec,
                planVersion: latestPlan,
                aligned: false,
                driftType: 'PLAN_AHEAD',
                driftDescription: `Plan bumped to v${latestPlan.version} but spec unchanged at v${latestSpec.version}`,
                specUpdatedAfterPlan: false,
            };
        }

        // Both changed or neither changed since alignment
        if (specChanged && planChanged) {
            // Both updated — consider aligned if plan is not behind
            return {
                featureId,
                specVersion: latestSpec,
                planVersion: latestPlan,
                aligned: true,
                driftType: 'NONE',
                driftDescription: `Both updated since alignment: spec v${latestSpec.version}, plan v${latestPlan.version}`,
                specUpdatedAfterPlan: false,
            };
        }

        // Neither changed — still aligned
        return {
            featureId,
            specVersion: latestSpec,
            planVersion: latestPlan,
            aligned: true,
            driftType: 'NONE',
            driftDescription: `Aligned: spec v${latestSpec.version}, plan v${latestPlan.version}`,
            specUpdatedAfterPlan: false,
        };
    }

    /**
     * Mark a feature as aligned (spec and plan are in sync).
     * Call this after a human reviews and approves the plan against the spec.
     */
    public markAligned(featureId: string): void {
        const specVersions = this.specs.get(featureId);
        const planVersions = this.plans.get(featureId);
        const specV = specVersions && specVersions.length > 0 ? specVersions[specVersions.length - 1].version : 0;
        const planV = planVersions && planVersions.length > 0 ? planVersions[planVersions.length - 1].version : 0;
        this.alignmentSnapshots.set(featureId, { specVersion: specV, planVersion: planV });
        this.callbacks.onAligned?.(featureId);
    }

    /**
     * Check if a task should be allowed given current drift status.
     * Blocks PLAN/CODE tasks when spec has drifted ahead of plan.
     */
    public checkTaskGate(featureId: string, taskType: string): { allowed: boolean; reason: string } {
        if (!this.config.blockOnDrift) {
            return { allowed: true, reason: 'Drift blocking disabled' };
        }

        const drift = this.checkDrift(featureId);

        if (drift.aligned || drift.driftType === 'NONE') {
            return { allowed: true, reason: `Feature ${featureId} is aligned` };
        }

        if (drift.driftType === 'MISSING_PLAN' && (taskType === 'CODE' || taskType === 'TEST' || taskType === 'DEPLOY')) {
            return { allowed: false, reason: `No plan for ${featureId}. Run /plan before implementation.` };
        }

        if (drift.driftType === 'SPEC_AHEAD' && (taskType === 'CODE' || taskType === 'DEPLOY')) {
            return { allowed: false, reason: `Spec drift detected for ${featureId}: ${drift.driftDescription}. Update plan first.` };
        }

        return { allowed: true, reason: `Drift type ${drift.driftType} does not block ${taskType}` };
    }

    /**
     * Get version history for a feature.
     */
    public getHistory(featureId: string): { specs: DocumentVersion[]; plans: DocumentVersion[] } {
        return {
            specs: [...(this.specs.get(featureId) ?? [])],
            plans: [...(this.plans.get(featureId) ?? [])],
        };
    }

    /**
     * Get all tracked features and their drift status.
     */
    public getAllDriftStatus(): DriftStatus[] {
        const features = new Set<string>([...this.specs.keys(), ...this.plans.keys()]);
        return [...features].map(f => this.checkDrift(f));
    }

    // ─── Internal ───

    private updateDocument(
        type: 'spec' | 'plan',
        featureId: string,
        content: string,
        docPath?: string,
    ): DocumentVersion | null {
        const store = type === 'spec' ? this.specs : this.plans;
        const versions = store.get(featureId) ?? [];
        const hash = hashContent(content);

        // Check if content actually changed
        if (versions.length > 0 && versions[versions.length - 1].hash === hash) {
            return null; // No change
        }

        const newVersion: DocumentVersion = {
            path: docPath ?? `docs/${type}s/${featureId}.md`,
            hash,
            version: versions.length + 1,
            updatedAt: Date.now(),
            sizeBytes: Buffer.byteLength(content, 'utf-8'),
        };

        versions.push(newVersion);
        store.set(featureId, versions);

        this.callbacks.onVersionBumped?.(featureId, type, newVersion);

        // Check drift after update
        const drift = this.checkDrift(featureId);
        if (!drift.aligned && drift.driftType !== 'NONE') {
            const severity = drift.driftType === 'SPEC_AHEAD' ? 'WARNING' :
                             drift.driftType === 'MISSING_PLAN' ? 'CRITICAL' : 'INFO';
            const alert: DriftAlert = {
                featureId,
                severity,
                message: drift.driftDescription,
                timestamp: Date.now(),
            };
            this.callbacks.onDriftDetected?.(alert);
        }

        return newVersion;
    }
}
