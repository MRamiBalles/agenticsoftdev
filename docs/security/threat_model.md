# Threat Model: Sovereign SDLC Platform

**Version:** 1.0
**Date:** 2026-02-08
**Scope:** Governance & Codebase Integrity

## 1. Assets protected
*   **Infrastructure Secrets**: API Keys (OpenAI, Supabase), Database URLs.
*   **Code Integrity**: Protection against malicious injection or accidental vulnerabilities.
*   **Governance Data**: ensuring the immutability of `governance_logs` (RACI audit trail).

## 2. Threat Actors
*   **The "Hallucinating" Agent**: An AI agent that accidentally invents insecure code patterns (e.g., hardcoded secrets, SQL injection).
*   **The "Lazy" Human**: A developer bypassing security checks for speed.
*   **Supply Chain Attacks**: Compromised npm dependencies.

## 3. Defense Mechanisms (The Shield)

| Threat | Defense Layer | Implementation (Tool) |
| :--- | :--- | :--- |
| **Hardcoded Secrets** | **SAST (Static Analysis)** | `scripts/analyze_security.ts` (Pattern Matching / ESLint Security) |
| **Injection Attacks (XSS/SQLi)** | **SAST** | `eslint-plugin-security` rules against `eval()`, `dangerouslySetInnerHTML` |
| **Vulnerable Dependencies** | **SCA (Composition Analysis)** | `npm audit` integration (Planned) |
| **Governance Bypass** | **Constitutional Block** | ATDI Penalty (+500 pts) locks the Dashboard UI. |

## 4. Risk Scoring (ATDI Integration)
Security risks are treated as **Critical Architectural Debt**.
*   **Critical Vulnerability**: +500 ATDI (Immediate Block).
*   **High Vulnerability**: +100 ATDI (Block).
*   **Medium Vulnerability**: +50 ATDI (Warning).

*Policy: "Security is not a feature; it is a constraint."*
