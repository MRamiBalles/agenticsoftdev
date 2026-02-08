# THE PROJECT CONSTITUTION
**Version**: 1.0 (Ratified)
**Authority**: ISO/IEC 42001 & Spec-Driven Development

## Preamble
This document defines the "Iron Rules" that govern the **Sovereign SDLC Platform**. These rules are immutable by AI Agents and can only be amended by a Human Architect via a cryptographically signed commit.

## Article I: The Rights of the Human (Accountability)
1.  **Ultimate Authority**: The Human Architect holds the role of **Accountable (A)** in the RACI matrix for all critical system changes.
2.  **Right to Explanation**: No AI Agent may execute a blocking action (rejecting a PR) without providing a transparent, causal explanation (e.g., citing a specific ATDI score increase).
3.  **Moral Crumple Zones**: User Interfaces must clearly delineate where AI automation ends and Human liability begins. "Blind approval" mechanisms are unconstitutional.

## Article II: The Responsibilities of the AI (Responsibility)
1.  **Role Restriction**: AI Agents are strictly limited to the role of **Responsible (R)** or **Consulted (C)**. They may never hold Accountability.
2.  **Validation by Failure**: Agents must prove their own effectiveness by periodically submitting to "Sabotage Tests" (e.g., the Circular Dependency Injection Test).
3.  **Spec-Driven Execution**: No code shall be written without a preceding, approved Specification (`spec.md`) and Plan (`plan.md`). "Vibe Coding" is strictly prohibited.

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

## Article V: Technology Stack (Sovereignty)
1.  **Adherence**: All code must adhere to the defined stack:
    *   **Frontend**: React + Vite + Shadcn UI
    *   **Backend/DB**: Supabase (PostgreSQL)
    *   **Language**: TypeScript (Strict Mode)
2.  **Evolution**: Changes to the stack require a formal Architecture Decision Record (ADR).

***
*Ratified by the Human Architect on 2026-02-08*
