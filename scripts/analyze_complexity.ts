
import { Project, SyntaxKind } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

// Constitutional Thresholds (Article III)
const THRESHOLDS = {
    LOC: 300,
    COMPLEXITY: 15,
    DEPENDENCIES: 10
};

// ATDI Weights (Docs/Architecture/atdi_thresholds.md)
const WEIGHTS = {
    LOC: 1, // 1 point per line over limit
    COMPLEXITY: 5, // 5 points per complexity unit over limit
    DEPENDENCIES: 2 // 2 points per dependency over limit
};

interface FileMetrics {
    file: string;
    loc: number;
    complexity: number; // Simplified Cyclomatic Complexity estimation
    dependencies: number;
    atdiContribution: number;
    reasons: string[];
}

function calculateComplexity(sourceFile: any): number {
    // Heuristic: Count control flow statements (if, for, while, switch, catch, conditions)
    let complexity = 1; // Base complexity
    sourceFile.forEachDescendant((node: any) => {
        switch (node.getKind()) {
            case SyntaxKind.IfStatement:
            case SyntaxKind.ForStatement:
            case SyntaxKind.ForInStatement:
            case SyntaxKind.ForOfStatement:
            case SyntaxKind.WhileStatement:
            case SyntaxKind.DoStatement:
            case SyntaxKind.CaseClause:
            case SyntaxKind.CatchClause:
            case SyntaxKind.ConditionalExpression: // Ternary
            case SyntaxKind.BinaryExpression: // && and ||
                // Check binary expression specifically for logical operators
                if (node.getKind() === SyntaxKind.BinaryExpression) {
                    const op = node.getOperatorToken().getKind();
                    if (op === SyntaxKind.AmpersandAmpersandToken || op === SyntaxKind.BarBarToken) {
                        complexity++;
                    }
                } else {
                    complexity++;
                }
                break;
        }
    });
    return complexity;
}

function analyzeProject() {
    console.log("🕵️ Starting ATDI Deep Scan (Complexity Sensor)...");

    const project = new Project({
        tsConfigFilePath: "tsconfig.app.json",
    });

    const sourceFiles = project.getSourceFiles();
    const riskReport: FileMetrics[] = [];
    let totalAtdi = 0;

    sourceFiles.forEach(sourceFile => {
        const filePath = path.relative(process.cwd(), sourceFile.getFilePath());
        if (filePath.includes("node_modules") || filePath.includes("dist") || filePath.includes("vite.config")) return;

        const loc = sourceFile.getEndLineNumber();
        const dependencies = sourceFile.getImportDeclarations().length;
        const complexity = calculateComplexity(sourceFile);

        let atdi = 0;
        const reasons: string[] = [];

        // 1. Check LOC
        if (loc > THRESHOLDS.LOC) {
            const penalty = (loc - THRESHOLDS.LOC) * WEIGHTS.LOC;
            atdi += penalty;
            reasons.push(`LOC ${loc} > ${THRESHOLDS.LOC} (+${penalty} pts)`);
        }

        // 2. Check Complexity
        if (complexity > THRESHOLDS.COMPLEXITY) {
            const penalty = (complexity - THRESHOLDS.COMPLEXITY) * WEIGHTS.COMPLEXITY;
            atdi += penalty;
            reasons.push(`Complexity ${complexity} > ${THRESHOLDS.COMPLEXITY} (+${penalty} pts)`);
        }

        // 3. Check Dependencies
        if (dependencies > THRESHOLDS.DEPENDENCIES) {
            const penalty = (dependencies - THRESHOLDS.DEPENDENCIES) * WEIGHTS.DEPENDENCIES;
            atdi += penalty;
            reasons.push(`Dependencies ${dependencies} > ${THRESHOLDS.DEPENDENCIES} (+${penalty} pts)`);
        }

        if (atdi > 0) {
            totalAtdi += atdi;
            riskReport.push({
                file: filePath,
                loc,
                complexity,
                dependencies,
                atdiContribution: atdi,
                reasons
            });
        }
    });

    // Output Report
    const reportPath = path.join(process.cwd(), ".ai", "atdi_complexity_report.json");
    const output = {
        timestamp: new Date().toISOString(),
        total_atdi: totalAtdi,
        files_analyzed: sourceFiles.length,
        risky_files: riskReport
    };

    fs.writeFileSync(reportPath, JSON.stringify(output, null, 2));

    console.log(`📊 Analysis Complete.`);
    console.log(`files analyzed: ${output.files_analyzed}`);
    console.log(`Risky Files Detected: ${riskReport.length}`);
    console.log(`Total ATDI Contribution: ${totalAtdi}`);

    if (totalAtdi > 0) {
        console.log("🚨 ARCHITECTURAL DEBT DETECTED! See .ai/atdi_complexity_report.json for details.");
        // We simulate a CI failure if debt is high
        if (totalAtdi > 50) {
            console.error("❌ CRITICAL: Debt exceeds safety limit. Deployment Blocked.");
            process.exit(1);
        }
    } else {
        console.log("✅ Architecture Clean.");
    }
}

analyzeProject();
