
import simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

const git = simpleGit();
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'data', 'org_debt_report.json');

interface FileStats {
    path: string;
    commits: number;
    authors: Set<string>;
    last_author_type: 'HUMAN' | 'AI' | null;
    swaps: number; // Human -> AI or AI -> Human
}

interface OrgDebtReport {
    generated_at: string;
    files: {
        path: string;
        authors: string[];
        commit_count: number;
        social_complexity: number;
        friction_score: number; // Swaps / Commits
        risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    }[];
}

async function analyzeOrgDebt() {
    console.log("⛏️ Mining Git History for Organizational Debt...");

    try {
        // Get log with file stats
        // We limit to last 1000 commits for performance in this scope
        const log = await git.log({
            '--stat': null,
            '--max-count': 1000
        });

        const fileMap = new Map<string, FileStats>();

        // Process commits in reverse chronological order (newest first)
        // But for "Swaps" logic, chronological (oldest first) might be easier to track flow.
        // Let's reverse the array.
        const commits = [...log.all].reverse();

        for (const commit of commits) {
            const authorName = commit.author_name;
            const authorType = isAgent(authorName) ? 'AI' : 'HUMAN';

            // simple-git's 'stat' might not be fully populated in basic log.
            // We might need to parse diff, but try basic diff first or just rely on commit-level granularity?
            // "log.all" has "diff" property if we ask? No, usually separate.
            // Let's use a simpler approach: "git log --name-only" equivalent.
            // simple-git `log` can take options.

            // Re-fetching per commit is slow.
            // Let's use raw list command for efficiency if possible, or just iterate.
            // Detailed stats per commit:
            if (commit.diff) {
                // simple-git parses diff if configured?
                // The type definition says 'diff' is nullable.
            }
        }

        // Alternative: Use raw command for easier parsing of "Name Status"
        const rawLog = await git.raw(['log', '--name-only', '--pretty=format:%H|%an|%cd', '--max-count=1000']);
        const lines = rawLog.split('\n');

        let currentAuthor = '';
        let currentAuthorType: 'HUMAN' | 'AI' = 'HUMAN';

        for (const line of lines) {
            if (!line.trim()) continue;

            if (line.includes('|')) {
                // Header line
                const parts = line.split('|');
                currentAuthor = parts[1];
                currentAuthorType = isAgent(currentAuthor) ? 'AI' : 'HUMAN';
            } else {
                // File line
                const filePath = line.trim();
                if (!fileMap.has(filePath)) {
                    fileMap.set(filePath, {
                        path: filePath,
                        commits: 0,
                        authors: new Set(),
                        last_author_type: null,
                        swaps: 0
                    });
                }

                const stats = fileMap.get(filePath)!;
                stats.commits++;
                stats.authors.add(currentAuthor);

                if (stats.last_author_type && stats.last_author_type !== currentAuthorType) {
                    stats.swaps++;
                }
                stats.last_author_type = currentAuthorType;
            }
        }

        // Generate Report
        const report: OrgDebtReport = {
            generated_at: new Date().toISOString(),
            files: []
        };

        for (const stats of fileMap.values()) {
            const sc = stats.authors.size + (stats.commits * 0.1);
            const friction = stats.commits > 1 ? (stats.swaps / stats.commits) : 0;

            let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            if (stats.authors.size > 3 || friction > 0.5) risk = 'HIGH';
            else if (stats.authors.size > 1 || friction > 0.3) risk = 'MEDIUM';

            report.files.push({
                path: stats.path,
                authors: Array.from(stats.authors),
                commit_count: stats.commits,
                social_complexity: parseFloat(sc.toFixed(2)),
                friction_score: parseFloat(friction.toFixed(2)),
                risk_level: risk
            });
        }

        // Sort by Social Complexity desc
        report.files.sort((a, b) => b.social_complexity - a.social_complexity);

        // Keep Top 50 to avoid clutter
        report.files = report.files.slice(0, 50);

        // Ensure output dir
        const outDir = path.dirname(OUTPUT_PATH);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
        console.log(`✅ Organization Debt Report generated: ${report.files.length} hotspots found.`);
        console.log(`🔥 Top Hotspot: ${report.files[0]?.path} (SC: ${report.files[0]?.social_complexity})`);

    } catch (e) {
        console.error("❌ Failed to analyze org debt:", e);
    }
}

function isAgent(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes('agent') ||
        lower.includes('bot') ||
        lower.includes('antigravity') ||
        lower.includes('ai') ||
        lower.includes('assistant') ||
        lower.includes('cline'); // Common agent names
}

analyzeOrgDebt();
