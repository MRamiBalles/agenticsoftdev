# Implementation Plan: Mission Control Dashboard

## Goal
Build the `MissionControl` page and integrating components.

## Proposed Changes

### 1. Data Layer (`src/lib/mission_control.ts`)
*   **`fetchADRs()`**: Import `adr_summary.json` (Needs to be accessible to frontend, potentially move to `public/` or serve via API). *Decision: Import directly as JSON for now.*
*   **`fetchATDITrend()`**: Query `governance_logs` for `atdi_score` ordered by date.

### 2. Components (`src/components/mission_control/`)
*   **`HealthMonitor.tsx`**: Uses `recharts` to render ATDI trend. Displays current score with Color Coding.
*   **`TimelineFeed.tsx`**: Renders ADRs as a vertical list.
*   **`ConeWidget.tsx`**: Simple visual component indicating project phase and uncertainty factor.

### 3. Page Assembly (`src/pages/MissionControl.tsx`)
*   Grid layout container.
*   Integrate existing `RaciCard` components for the "Governance Panel" section.

### 4. Routing
*   Add route `/mission-control` in `App.tsx`.
*   Update `AppNavbar.tsx` to include link.

## Verification
*   **Visual Check**:
    *   Verify ADR-001 appears in timeline.
    *   Verify ATDI score is 0.0 (Green).
    *   Verify Pending Tasks allow interaction.
