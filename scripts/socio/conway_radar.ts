
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import madge from 'madge';

const TARGET_DIR = path.join(process.cwd(), 'src');
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'reports', 'conway_friction_radar.md');

interface FileOwnership {
    file: string;
    authors: Record<string, number>; // author -> commit count
    top_author: string;
    team_friction: number; // 0-1 (0 = single owner, 1 = chaos)
}

async function analyzeConwayAlignment() {
    console.log("📡 [Conway Radar] Scanning Socio-Technical Topography...");

    // 1. Get Dependency Graph (Technical Structure)
    const res = await madge(TARGET_DIR, {
        fileExtensions: ['ts', 'tsx'],
        excludeRegExp: [/\.test\.ts$/, /\.spec\.ts$/]
    });
    const graph = res.obj();

    // 2. Analyze Git History (Social Structure)
    const ownership: Record<string, FileOwnership> = {};
    const files = Object.keys(graph);

    files.forEach(file => {
        try {
            // Get contributors for this file
            const fullPath = path.join(TARGET_DIR, file);
            if (!fs.existsSync(fullPath)) return;

            const log = execSync(`git log --pretty=format:"%an" "${fullPath}"`, { encoding: 'utf-8' });
            const authors = log.split('\n').filter(a => a).reduce((acc, author) => {
                acc[author] = (acc[author] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const totalCommits = Object.values(authors).reduce((a, b) => a + b, 0);
            const authorList = Object.entries(authors).sort((a, b) => b[1] - a[1]);
            const topAuthor = authorList[0]?.[0] || 'Unknown';

            // Friction Metric: 1 - (Top Author Commits / Total Commits)
            // If Top Author did 100% of work, Friction = 0.
            // If Top Author did 30% of work (fragmented), Friction = 0.7.
            const friction = totalCommits > 0 ? 1 - (authorList[0][1] / totalCommits) : 0;

            ownership[file] = {
                file,
                authors,
                top_author: topAuthor,
                team_friction: parseFloat(friction.toFixed(2))
            };

        } catch (e) {
            // Git might fail on new files
        }
    });

    // 3. Detect Cross-Team Dependency Friction
    // "Team A's component depends on Team B's component" is fine IF defined.
    // Measuring "Implicit Friction": High Coupling + Different Main Authors.
    const frictionHotspots: { file: string; dependency: string; author_a: string; author_b: string }[] = [];

    Object.entries(graph).forEach(([file, deps]) => {
        const ownerA = ownership[file];
        if (!ownerA) return;

        deps.forEach(dep => {
            const ownerB = ownership[dep];
            if (!ownerB) return;

            // If the owners are different effectively (ignoring self)
            // In a real org, map authors to Teams. Here, Author = Team proxy.
            if (ownerA.top_author !== ownerB.top_author) {
                frictionHotspots.push({
                    file: file,
                    dependency: dep,
                    author_a: ownerA.top_author,
                    author_b: ownerB.top_author
                });
            }
        });
    });

    // 4. Generate Report
    let report = `# 📡 Conway Friction Radar
**Generated:** ${new Date().toISOString()}

## 1. High Friction Zones (Cognitive Dissonance)
Files where multiple authors are competing for dominance (Friction > 0.5).

| File | Top Author | Friction Score | Contributors |
|---|---|---|---|
`;

    Object.values(ownership)
        .filter(o => o.team_friction > 0.3)
        .sort((a, b) => b.team_friction - a.team_friction)
        .forEach(o => {
            report += `| \`${o.file}\` | **${o.top_author}** | 🔴 ${o.team_friction} | ${Object.keys(o.authors).join(', ')} |\n`;
        });

    report += `\n## 2. Socio-Technical Boundaries (Team Crossing)
Where code dependencies cross "Author Boundaries" (Conway's Law risk).

| Consumer (File) | Owner | --> | Provider (Dep) | Owner |
|---|---|---|---|---|
`;

    frictionHotspots.slice(0, 20).forEach(h => { // Limit output
        report += `| \`${h.file}\` | ${h.author_a} | --> | \`${h.dependency}\` | ${h.author_b} |\n`;
    });

    // Ensure dir
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, report);
    console.log(`✅ [Conway Radar] Report generated: ${OUTPUT_PATH}`);
    console.log(`   - Contributors Analyzed: ${files.length} files`);
    console.log(`   - Cross-Boundary Dependencies: ${frictionHotspots.length}`);
}

analyzeConwayAlignment();
