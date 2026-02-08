# ATDI Thresholds & Metrics (v2.0)

**Authority**: `constitution.md` Article III
**Purpose**: Define the exact numeric limits for "God Components" and "Complexity" to ensure deterministic governance.

## 1. Complexity Thresholds (The "God Component" Definition)

| Metric | Warning (Amber) | Critical (Red/Block) | Justification (Source) |
| :--- | :--- | :--- | :--- |
| **Lines of Code (LOC)** | > 200 | > 300 | Single Responsibility Principle. Hard to read/maintain. |
| **Cyclomatic Complexity** | > 10 | > 15 | Testing difficulty increases exponentially. (McCabe) |
| **Dependency Degree (Fan-Out)** | > 7 | > 10 | High coupling makes components fragile. (Verdecchia) |
| **Public Methods** | > 10 | > 20 | Indicates a "God Class" managing too much state. |

## 2. Stability Thresholds (The "Unstable Dependency" Definition)

| Metric | Definition | Threshold |
| :--- | :--- | :--- |
| **Instability (I)** | $I = \frac{FanOut}{FanIn + FanOut}$ | Core Modules must have $I < 0.3$. |
| **Churn Rate** | Frequency of commits to a file. | > 3 commits/week = "Volatile". |

## 3. ATDI Contribution Formula (Deterministic SHAP)

The Guardian Agent calculates the **Cost of Debt** using this linear formula:

$$ATDI_{Total} = \sum_{file} (Risk_{Cycle} + Risk_{Complexity} + Risk_{Coupling})$$

Where:
*   $Risk_{Cycle} = 100 \text{ points}$ (Critical Blocker)
*   $Risk_{Complexity} = (Complexity_{Actual} - Threshold) \times 5 \text{ points}$
*   $Risk_{Coupling} = (Deps_{Actual} - Threshold) \times 2 \text{ points}$

**Example:**
A file with Complexity 20 (Limit 15) and 12 Deps (Limit 10):
*   Complexity Penalty: $(20 - 15) \times 5 = 25$
*   Coupling Penalty: $(12 - 10) \times 2 = 4$
*   **Total ATDI:** 29 (Red Alert)
