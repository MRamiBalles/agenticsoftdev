# Security Operations Guide (SecOps)

**Version:** 1.0
**Target Audience:** Accountable Owners, Lead Engineers, Security Officers
**Scope:** Management of the Sovereign SDLC Security Shield

## 1. The Security Shield (Architecture)
The platform is protected by a multi-layered automated defense system:

*   **Layer 1 (SAST):** `analyze_security.ts` scans source code for:
    *   **Secrets:** API Keys, Tokens (Regex-based).
    *   **Injections:** `eval()`, SQL, unsafe innerHTML (ESLint).
*   **Layer 2 (SCA):** Checks `package.json` against the npm vulnerability database (`npm audit`) for Critical/High CVEs.
*   **Layer 3 (Governance):** The ATDI Engine applies a **+500 Point Penalty** for any critical finding, triggering a hard block in the Dashboard.

## 2. Incident Response Protocol

### Scenario A: Dashboard shows "Red Pulsing Alert" (Security Block)
**Trigger:** ATDI score > 100 with "SECURITY THREAT" tag.

1.  **Investigate:**
    *   Check `governance_logs` or the "Risk Analysis" panel in the dashboard.
    *   Identify the file and line number.
2.  **Remediate:**
    *   **Secrets:**
        *   **REVOKE** the exposed credential immediately.
        *   **ROTATE** the key in the provider (e.g., OpenAI, AWS).
        *   **REMOVE** the code. Use `.env` files for local dev and Vault/Secrets Manager for production.
        *   **SANITIZE** git history if the commit was pushed (use `git filter-repo`).
    *   **Vulnerabilities (SCA):**
        *   Run `npm audit fix` or upgrade the package or `npm uninstall`.
3.  **Verify:**
    *   Run `npx ts-node scripts/analyze_security.ts` locally.
    *   Confirm output is `Violations Found: 0`.

### Scenario B: False Positive
**Context:** The scanner flags a random string as a secret, or a safe dependency as vulnerable.

1.  **Direct Override (Not Recommended):**
    *   The Accountable Human *can* technically force sign the release on the Dashboard if urgency dictates, but this is logged as a **Constitutional Override**.
2.  **Rule Tuning (Preferred):**
    *   Adjust `scripts/analyze_security.ts` ignore lists or Regex patterns.
    *   Create a PR with justification "Security Tuning".

## 3. Secret Management Policy (Article IV)
*   **Forbidden:** `const key = "sk-..."` in any `.ts` file.
*   **Allowed:** `process.env.OPENAI_API_KEY`.
*   **Storage:**
    *   Local: `.env` (gitignored).
    *   CI/CD: GitHub Actions Secrets / Supabase Vault.

## 4. Audit & Compliance
*   All security blocks and overrides are cryptographically signed and stored in `governance_logs`.
*   Quarterly Review: Security Officer audits the logs for recurring patterns of negligence.

---
*“Security is not just a feature, it’s a condition for sovereignty.”*
