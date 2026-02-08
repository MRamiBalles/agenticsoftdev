# Specification: Architectural Technical Debt Index (ATDI) Module

## 1. Context
Current governance ensures *who* signs off (RACI). This module ensures *what* is signed off meets quality standards. It acts as a "Guardian Agent" preventing architectural erosion.

## 2. Functional Requirements

### 2.1 Static Analysis Engine
*   **Input**: Source code directory (`src/`).
*   **Process**: Parse imports/exports to build a Dependency Graph.
*   **Output**: A list of nodes (files) and edges (dependencies).

### 2.2 Smell Detection
The system must identify specific "Architectural Smells" defined in `atdi_formula.md`:
*   **Cyclic Dependency (CD)**: $A \rightarrow B \rightarrow A$.
    *   **Severity**: High (10).
*   **God Component (GC)**: A file with incoming+outgoing dependencies > Threshold (e.g., 20).
    *   **Severity**: Medium (5).

### 2.3 ATDI Calculation
*   **Formula**: $ATDI = \sum (Severity \times Size)$
*   **Logic**:
    *   Analyze entire graph.
    *   Identify all smells.
    *   Sum their weighted scores.
*   **Trend Analysis**: detailed report explaining the score.

### 2.4 Governance Integration
*   **Deployment Gate**:
    *   **Green (ATDI < 5)**: Allowed.
    *   **Amber (5 <= ATDI < 15)**: Warning. Requires justification.
    *   **Red (ATDI >= 15)**: Blocked. Requires "Exception Signature".
*   **UI**:
    *   Show ATDI Score on `RaciCard`.
    *   Show "Risk Factors" (e.g., "Cycle detected in auth.ts").

## 3. Technical Constraints
*   **Stack**: TypeScript (Node.js script for analysis).
*   **Performance**: Must run in < 5s for the current codebase.
*   **Database**: Store results in Supabase.
