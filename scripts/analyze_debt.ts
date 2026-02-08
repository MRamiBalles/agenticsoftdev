
import madge from 'madge';
import path from 'path';
import fs from 'fs';

// Configuration
const SRC_DIR = path.join(process.cwd(), 'src');
const GOD_COMPONENT_THRESHOLD = {
    lines: 300,
    dependencies: 10
};
const SEVERITY = {
    CYCLE: 10,
    GOD_COMPONENT: 5
};

interface Smell {
    type: 'CYCLE' | 'GOD_COMPONENT';
    severity: number;
    description: string;
    files: string[];
}

interface AnalysisReport {
    atdi_score: number;
    smells: Smell[];
    nodes_count: number;
    edges_count: number;
    timestamp: string;
}

async function analyzeDebt() {
    console.log(`🔍 Starting ATDI Analysis on ${SRC_DIR}...`);

    try {
        const res = await madge(SRC_DIR, {
            fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
            excludeRegExp: [/\.test\./, /\.spec\./, /node_modules/]
        });

        const dependencyGraph = res.obj();
        const circulars = res.circular();

        let atdiScore = 0;
        const smells: Smell[] = [];

        // 1. Detect Cycles
        if (circulars && circulars.length > 0) {
            console.log(`⚠️  Detected ${circulars.length} Circular Dependencies`);
            circulars.forEach(cycle => {
                const size = cycle.length;
                const score = SEVERITY.CYCLE * size; // Weight by size of cycle
                atdiScore += score;
                smells.push({
                    type: 'CYCLE',
                    severity: SEVERITY.CYCLE,
                    description: `Circular dependency detected: ${cycle.join(' -> ')}`,
                    files: cycle
                });
            });
        }

        // 2. Detect God Components
        const keys = Object.keys(dependencyGraph);
        for (const file of keys) {
            const deps = dependencyGraph[file];
            const filePath = path.join(SRC_DIR, file);

            // Check existence before reading to avoid errors with virtual/alias files
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n').length;
                const depCount = deps.length;

                if (lines > GOD_COMPONENT_THRESHOLD.lines && depCount > GOD_COMPONENT_THRESHOLD.dependencies) {
                    const score = SEVERITY.GOD_COMPONENT; // Flat score for God Component
                    atdiScore += score;
                    smells.push({
                        type: 'GOD_COMPONENT',
                        severity: score,
                        description: `God Component detected: ${file} (${lines} loc, ${depCount} deps)`,
                        files: [file]
                    });
                }
            }
        }

        const report: AnalysisReport = {
            atdi_score: atdiScore,
            smells: smells,
            nodes_count: keys.length,
            edges_count: keys.reduce((acc, k) => acc + dependencyGraph[k].length, 0),
            timestamp: new Date().toISOString()
        };

        console.log('\n📊 ATDI Analysis Report');
        console.log('-----------------------');
        console.log(`Nodes: ${report.nodes_count}`);
        console.log(`Edges: ${report.edges_count}`);
        console.log(`Smells Detected: ${report.smells.length}`);
        console.log(`\n📉 Final ATDI Score: ${report.atdi_score}`);

        if (report.atdi_score === 0) {
            console.log('✅ Clean Architecture. No strict smells detected.');
        } else {
            console.log('🚨 Architectural Debt Detected!');
            report.smells.forEach(s => console.log(` - [${s.type}] ${s.description}`));
        }

        return report;

    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    }
}

analyzeDebt();
