# THE PROJECT CONSTITUTION
**Version**: 1.0 (Ratified)
**Authority**: ISO/IEC 42001 & Spec-Driven Development

## Preamble
This document defines the "Iron Rules" that govern the **Sovereign SDLC Platform**. These rules are immutable by AI Agents and can only be amended by a Human Architect via a cryptographically signed commit.

## Article I: The Rights of the Human (Accountability - 'A')
1.  **Ultimate Authority (Gold Rule)**: The Human Architect is the sole holder of the **Accountable (A)** role. The AI cannot legally or ethically accept liability.
2.  **Cryptographic Sovereignty**: Critical strategic decisions (e.g., Production Deployments, Budget Changes, Kill-Switch Activation) require a cryptographically signed human approval (GPG/Sigstore). "Vibe approvals" are invalid.
3.  **Right to Explanation**: No AI Agent may execute a blocking action without transparent justification.
4.  **Moral Crumple Zones**: Interfaces must clearly delineate AI automation from Human liability.

## Article II: The Responsibilities of the AI (Responsibility - 'R')
1.  **Execution only**: AI Agents are strictly limited to the role of **Responsible (R)** (Execution) or **Consulted (C)** (Analysis).
2.  **Validation by Failure**: Agents must submit to periodic "Sabotage Tests" to prove resilience.
3.  **Spec-Driven Execution**: Code must be derived from an approved `spec.md` and `plan.md`.

## Article III: Architectural Standards (Quality)
1.  **Zero-Tolerance for Cycles**: Circular dependencies between modules are classified as Critical Defects (Severity 10).
2.  **God Component Limit**: 
    *   **Max Lines of Code (LOC)**: 300 lines per file.
    *   **Max Complexity (Cyclomatic)**: 15 per function.
    *   **Max Dependencies**: 10 imports per module.
    *   *Violation Effect*: AUTOMATIC REJECTION of the Pull Request.
3.  **Unstable Matrix**: Stable core components must not depend on unstable/volatile modules (Stable Dependency Principle).
4.  **The Guardian's Veto**: The Architect Agent (ATDI Module) has the constitutional power to veto any deployment that violates these standards.

## Article IV: Integrity & Security (The Shield)
1.  **Secret Sovereignty**: No credentials, API keys, or tokens shall be hardcoded. Violation is Severity 10 (Critical Block).
2.  **Injection Prevention**: Use of `eval()`, `dangerouslySetInnerHTML` (without sanitization), or raw SQL queries is prohibited.
3.  **Dependency Hygiene**: No production dependency with Critical CVEs is allowed.
4.  **Security Gating**: A single Critical Security Vulnerability triggers an automatic ATDI penalty of +500 points.

## Article V: Structural Integrity & Active Defense (Sovereignty)
1.  **Auto-Revert Authority**: The system possesses delegated authority to automatically revert any commit that introduces Critical Architectural Smells (e.g., Circular Dependencies) or violates Socio-Technical Friction thresholds (>0.8).
2.  **Stability First**: The stability of the architecture and the health of the organization prevail over the speed of feature delivery.
3.  **Self-Righting Mechanism**: Agents must not impede the operation of the SRE Auto-Revert protocol.

## Article VI: Technology Stack (Standardization)
1.  **Adherence**: All code must adhere to the defined stack:
    *   **Frontend**: React + Vite + Shadcn UI
    *   **Backend/DB**: Supabase (PostgreSQL)
    *   **Language**: TypeScript (Strict Mode)
2.  **Evolution**: Changes to the stack require a formal Architecture Decision Record (ADR).

## Article VII: Succession & Continuous Audit
1.  **Chain of Command**: In the event of primary Accountable absence, a secondary cryptographic key [`SIG-GUARD-ALT`] may be activated for critical interventions.
2.  **Intent of the Legislator**: Agents must interpret rules based on the `sovereign_handbook.md`, which documents the ethical and strategic intent behind the code.
3.  **Renovation Ritual**: Every 180 days, the Chief of Staff must trigger a "Renewal Audit" to propose constitutional enmiendas based on evolving AI legislation.

***
*Ratified by the Human Architect on 2026-02-08*
