# Implementation Plan: Architect Agent (ATDI)

## Goal
Implement the Static Analysis Engine and integrate it into the Governance Dashboard to block high-risk changes.

## Proposed Changes

### 1. Analysis Engine (`scripts/analyze_debt.ts`)
*   **Tooling**: Use `madge` (via API) for robust dependency extraction.
*   **Logic**:
    1.  Generate graph object.
    2.  Find Cycles (`madge.circular()`).
    3.  Find God Components (Count dependencies per node).
    4.  Calculate ATDI Score based on `atdi_formula.md`.
*   **Output**: JSON report `{ score: number, smells: [] }`.

### 2. Database Schema (`supabase/migrations/...`)
*   **Table Update**: Add columns to `task_assignments` (or `governance_logs`):
    *   `atdi_score`: Integer.
    *   `risk_report`: JSONB (Stores the smells details).

### 3. API / Logic (`src/lib/quality.ts`)
*   **`runQualityCheck(path)`**: Function to execute the analysis script.
*   **`assessRisk(score)`**: Returns 'LOW', 'MEDIUM', 'HIGH'.

### 4. UI Updates (`src/components/governance/RaciCard.tsx`)
*   **Visuals**:
    *   Add Badge: "ATDI: X.X" (Color coded).
    *   Add "Smell Details": Collapsible section listing cycles/GCs.
*   **Behavior**:
    *   If Risk=HIGH, disable "Approve" button or change text to "Request Exception".

## Verification Plan

### Automated Test
1.  Create `tests/bad_architecture/`:
    *   `cycle_a.ts` imports `cycle_b.ts`.
    *   `cycle_b.ts` imports `cycle_a.ts`.
2.  Run `analyze_debt.ts` on this folder.
3.  Expect: `score >= 20` (Severity 10 * Size 2).

### Manual Dogfooding
1.  Run analysis on `src/`.
2.  View score in Dashboard.
