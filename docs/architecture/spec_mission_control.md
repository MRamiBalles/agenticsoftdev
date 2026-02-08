# Specification: Mission Control Dashboard (v2.0)

## 1. Objective
Unify Project Health (ATDI), Institutional Memory (ADRs), and Governance (RACI) into a single "Command Center" interface. This dashboard empowers the **Accountable Human** to direct the **Responsible Agents**.

## 2. Functional Requirements

### 2.1 Health Monitor (ATDI)
*   **Visual**: Gauge/Metric displaying current ATDI Score (0.0).
*   **Trend**: Line chart showing ATDI evolution over the last 10 deployments.
*   **Source**: Data from `governance_logs` table.

### 2.2 Institutional Memory (ADR Timeline)
*   **Visual**: Chronological feed of "Accepted" decisions.
*   **Interactivity**: Click to expand context ("Why did we choose SDD?").
*   **Source**: Parsed from `.ai/knowledge_base/adr_summary.json`.

### 2.3 Governance Panel (Moral Crumple Zone)
*   **Visual**: List of `PENDING` approvals grouped by Risk Level.
*   **Action**: "Approve/Reject" buttons with mandatory justification input.
*   **Safety**: Explicit delineation of Agent vs. Human responsibility.

### 2.4 Project Status (Cone of Uncertainty)
*   **Visual**: Progress bar/Widget showing current phase (`Specify` -> `Plan` -> `Implement`).
*   **Metric**: Current "Variance Estimate" (e.g., 4x in Specify, 1x in Implement).

## 3. User Experience (UX)
*   **Tone**: "Calm Control". Avoid data saturation.
*   **Layout**: Grid-based.
    *   Top: Key Metrics (ATDI, Risk Level).
    *   Left: Timeline & Memory.
    *   Right: Actionable Governance Tasks.

## 4. Technical Constraints
*   **Frontend**: React + Shadcn UI + Recharts (for trend graph).
*   **Data**: Supabase for real-time logs; JSON import for ADRs.
