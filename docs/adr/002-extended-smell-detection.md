# ADR-002: Extended Architectural Smell Detection

**Date:** 2026-02-08
**Status:** ACCEPTED

## Context
The v1.0 platform successfully detects **Circular Dependencies** (Severity 10) using `madge`. However, this is insufficient. A codebase can be acyclic but still unmaintainable if it contains **God Components** (giant files), **High Complexity** (nested logic), or **Hub-like Dependencies**. Our current ATDI formula ($S \times T$) ignores these intra-module risks, leaving a governance gap.

## Decision
We will extend the ATDI Engine to analyze **Complexity Metrics** and **Coupling Metrics**, moving from Topological Analysis (Graph-level) to Static Code Analysis (File-level).

1.  **Metric Adoption:** We adopt LOC, Cyclomatic Complexity, and Fan-Out as "Hard Metrics" with constitutional limits.
2.  **Tooling:** We select **`ts-morph`** for robust AST navigation and **`typhonjs-escomplex`** for standardized metrics calculation. This ensures precision over regex-based approaches.
3.  **Deterministic Explanations:** The ATDI score will be a sum of weighted penalties. This allows "Heuristic Explainability" without ML models (e.g., "Score is 50 because file X is too complex").

## Consequences

### Positive
*   **Preventative Hygiene:** Stops "spaghetti code" inside valid modules.
*   **Granular Feedback:** Developers get specific reasons for rejection ("Reduce function complexity").
*   **ISO 42001 Alignment:** Enhances "Accuracy and Robustness" controls.

### Negative
*   **Pipeline Latency:** AST parsing is slower than simple graph scraping.
*   **False Positives:** Legitimate complex algorithms might be flagged, requiring a "Human Override" mechanism.

## Compliance
*   **Constitutional Rule:** Art III.2 (God Component Limit).
*   **References:** Sas & Avgeriou (2019) - "Architectural Technical Debt Identification".
