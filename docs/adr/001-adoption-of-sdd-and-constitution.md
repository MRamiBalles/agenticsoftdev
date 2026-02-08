# ADR-001: Adoption of Spec-Driven Development and Constitution

**Date:** 2026-02-08
**Status:** ACCEPTED

## Context
In the era of Agentic AI, traditional software development practices are insufficient to guarantee safety, quality, and accountability. Without strict governance, AI agents ("Coding Swarms") may introduce complex, unmaintainable code ("Vibe Coding") or make unauthorized architectural decisions. We need a framework that ensures Human Accountability (ISO 42001) while leveraging AI velocity.

## Decision
We will adopt **Spec-Driven Development (SDD)** as our core methodology and establish a **Project Constitution** as the supreme authority.

1.  **SDD Workflow**: All code changes must follow the sequence: `/specify` -> `/plan` -> `/implement`. No implementation is allowed without an approved Specification and Plan.
2.  **Constitution**: We adopt `constitution.md` as the immutable set of rules governing both Human and AI actors.
3.  **Iron Rules**: We enforce strict RACI roles (Human=Accountable, AI=Responsible) at the database level.
4.  **Architectural Guardians**: We utilize ATDI (Architectural Technical Debt Index) to mathematically block structural degradation.

## Consequences

### Positive
*   **Sovereignty**: Humans retain absolute control over *what* is built, while AI handles *how* it is built.
*   **Liability Protection**: The "Moral Crumple Zone" design protects human operators from liability for "blind" decisions.
*   **Quality Guarantee**: Mathematical limits on technical debt (ATDI) prevent long-term project rot.
*   **Compliance**: Built-in alignment with ISO/IEC 42001 standards for AI governance.

### Negative
*   **Velocity Friction**: The requirement for Specs and Plans slows down "quick fixes" or exploratory coding.
*   **Rigidity**: Changing the tech stack or core rules requires a formal Constitutional Amendment (ADR).

## Compliance
*   **Constitutional Rule**: Article II.3 (Spec-Driven Execution).
*   **ISO 42001 Control**: A.3.2 (Human Oversight).
