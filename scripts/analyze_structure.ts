
import madge from 'madge';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIR = path.join(process.cwd(), 'src');
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'data', 'architecture_report.json');

interface NodeMetrics {
    id: string;
    fanIn: number;
    fanOut: number;
    instability: number; // 0-1
    isHub: boolean;
}

interface ArchitectureReport {
    generated_at: string;
    circular_dependencies: string[][];
    hubs: NodeMetrics[];
    unstable_nodes: NodeMetrics[]; // Top 20 most unstable
    sdp_violations: { stable: string; unstable: string; diff: number }[]; // Stable Depending on Unstable
    metrics: Record<string, NodeMetrics>;
}

async function analyzeStructure() {
    console.log("📡 Scanning Architecture Topography...");

    try {
        const res = await madge(TARGET_DIR, {
            fileExtensions: ['ts', 'tsx'],
            excludeRegExp: [/\.test\.ts$/, /\.spec\.ts$/, /setupTests\.ts$/]
        });

        const dependencyGraph = res.obj();
        const circular = res.circular();

        // Calculate Metrics
        const metrics: Record<string, NodeMetrics> = {};
        const incomingEdges: Record<string, number> = {};

        // Initialize
        Object.keys(dependencyGraph).forEach(file => {
            metrics[file] = { id: file, fanIn: 0, fanOut: 0, instability: 0, isHub: false };
            incomingEdges[file] = 0;
        });

        // Compute Fan-Out and Accumulate Fan-In
        Object.entries(dependencyGraph).forEach(([file, deps]) => {
            if (!metrics[file]) return;
            metrics[file].fanOut = deps.length;

            deps.forEach(dep => {
                if (metrics[dep]) {
                    metrics[dep].fanIn++;
                }
            });
        });

        // Compute Instability & Identify Hubs
        Object.values(metrics).forEach(node => {
            const total = node.fanIn + node.fanOut;
            node.instability = total === 0 ? 0 : node.fanOut / total;

            // Hub Definition: High Fan-In AND High Fan-Out
            // It's a busy junction.
            if (node.fanIn > 5 && node.fanOut > 5) {
                node.isHub = true;
            }
        });

        // Detect SDP Violations (Stable Dependency Principle)
        // A Stable component (Low I) should not depend on an Unstable component (High I).
        const sdpViolations: { stable: string; unstable: string; diff: number }[] = [];

        Object.entries(dependencyGraph).forEach(([file, deps]) => {
            const stableNode = metrics[file];
            if (!stableNode) return;

            deps.forEach(dep => {
                const unstableNode = metrics[dep];
                if (!unstableNode) return;

                // Violation: I_depender < I_dependee
                // We want Depender to be LESS stable (Higher I) than Dependee.
                // Wait, SDP says: "Depend in the direction of stability".
                // So Dependee (provider) should be MORE stable (Lower I) than Depender (consumer).
                // Violation if: Dependee.I > Depender.I
                // Using a threshold to avoid noise (e.g., diff > 0.3)

                if (unstableNode.instability > stableNode.instability + 0.3) {
                    sdpViolations.push({
                        stable: file,
                        unstable: dep,
                        diff: parseFloat((unstableNode.instability - stableNode.instability).toFixed(2))
                    });
                }
            });
        });

        const report: ArchitectureReport = {
            generated_at: new Date().toISOString(),
            circular_dependencies: circular,
            hubs: Object.values(metrics).filter(m => m.isHub).sort((a, b) => (b.fanIn + b.fanOut) - (a.fanIn + a.fanOut)),
            unstable_nodes: Object.values(metrics).sort((a, b) => b.instability - a.instability).slice(0, 20),
            sdp_violations: sdpViolations.sort((a, b) => b.diff - a.diff).slice(0, 20),
            metrics: metrics
        };

        // Ensure output dir
        const outDir = path.dirname(OUTPUT_PATH);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

        console.log(`✅ Architecture Report Generated.`);
        console.log(`🔄 Circular Dependencies: ${circular.length}`);
        console.log(`🕸️ Hubs Detected: ${report.hubs.length}`);
        console.log(`⚠️ SDP Violations: ${sdpViolations.length}`);

        if (circular.length > 0) {
            console.log("CRITICAL: Cycles found:");
            console.log(JSON.stringify(circular, null, 2));
        }

    } catch (e) {
        console.error("❌ Architecture Analysis Failed:", e);
    }
}

analyzeStructure();
