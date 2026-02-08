# Use Case: Refactoring Core Systems 🧠⚙️

**Scenario:** The SRE Monitor has flagged `UserAuth.ts` as a "God Component" (ATDI > 0.8). You need to break it down.

## The Sovereign Workflow

1.  **Specify the Intent (`/specify`)**
    *   **User:** "Refactor `UserAuth.ts` to separate Session logic from Identity logic."
    *   **Agent:** Checks `spec.md`. Is this aligned with the Roadmap? **YES**.

2.  **Plan the Architecture (`/plan`)**
    *   **Agent:** Generates a topological sort of dependencies.
    *   **Governance:** "Warning: Splitting this file may create a cycle with `SessionManager.ts`. Please use Dependency Injection."
    *   **Result:** `plan.md` updated with Interface definitions.

3.  **Implement Safe Changes (`/implement`)**
    *   **Agent:** Creates `IAuthService.ts`.
    *   **SRE Monitor:** Watches the build. If `npm test` fails -> **AUTO-REVERT**.

4.  **Verify and Sign (`/verify`)**
    *   **Agent:** "Refactor complete. ATDI reduced from 0.85 to 0.4."
    *   **Human:** Reviews the `architecture_report.json` diff.
    *   **Action:** Sign off deploy.
