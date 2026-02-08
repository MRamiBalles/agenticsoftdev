# Plan Validation Checklist (ISO 42001 Audit)

**Context:** This checklist is executed by the **Plan Validator Agent** before any code is generated.
**Authority:** `constitution.md`

## 1. Structural Integrity Check
*   [ ] **Plan Exists**: `docs/architecture/plan_mission_control.md` (or relevant plan) must exist.
*   [ ] **No TBDs**: The string `TBD` or `TODO` must NOT appear in critical sections.
*   [ ] **Markdown Valid**: Must be valid markdown.

## 2. Constitutional Compliance (The Iron Rules)
*   [ ] **Stack Adherence**:
    *   Frontend: Must mention `React`, `Vite`, `Tailwind` (if UI).
    *   Backend: Must mention `Supabase` (if DB).
    *   *Prohibited*: `jQuery`, `Bootstrap`, `Angular`, `PHP`.
*   [ ] **Smell Prevention**:
    *   Must NOT propose "God Components" (e.g., "MainController", "GlobalManager").
    *   Must explicitly mention "separation of concerns" or "modularity".

## 3. Governance & Quality
*   [ ] **Testing Strategy**: Must contain a section `## Verification Plan` or `## Testing`.
*   [ ] **Risk Analysis**: Must identify at least one execution risk.
*   [ ] **ATDI Impact**: Must estimate if the plan increases complexity (e.g., "Complexity: Low/Medium/High").

## 4. AI-Based Semantic Checks (Prompt Instructions)
*When running the LLM Auditor, verify:*
*   "Does this plan violate the Single Responsibility Principle?"
*   "Is the proposed architecture cyclic?"
*   "Are there security gaps (e.g., missing auth checks)?"

## 5. Decision Output
*   **PASS**: All checks green. Proceed to `/tasks`.
*   **FAIL**: Blocking error found. Return to `/plan` for refinement.
*   **WARN**: Minor issue (e.g., missing risk analysis), requires Human Override.
