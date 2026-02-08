# 📉 Playbook: Debt Bankruptcy (PROTOCOL-002)

**Trigger:** ATDI Score > 20% (System is blocking all new features).
**Severity:** CRITICAL

## 1. Declaration of Bankruptcy
When the system refuses to accept new code due to accumulation of smells:

1.  **Stop all Feature Work.**
2.  **Run Full Analysis:**
    ```bash
    npx tsx scripts/analyze_structure.ts
    ```

## 2. Refactoring Campaign
Use the "Architecture Radar" to identify the top 3 offenders (usually Hubs or Cycles).

1.  **Isolate the Hub:** Break the file into smaller components.
2.  **Break the Cycle:** Use Dependency Injection (DI) to invert control.

## 3. Constitution Amendment (Last Resort)
If the debt is unavoidable (e.g., Legacy Audit):

1.  Edit `constitution.md`.
2.  Increase `MAX_COMPLEXITY` temporarily.
3.  **MUST** include a "Sunset Clause" (date when it reverts).
4.  Generate an ADR explaining why:
    ```bash
    npx tsx scripts/cognitive/adr_engine.ts --title="Temporary_ATDI_Relaxation" --context="Legacy migration" --decision="Raise limit to 30%"
    ```
