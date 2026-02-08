# Protocol D: Spec-Driven Development (SDD) Manifesto
> **Source**: GitHub Spec Kit & Modern Agile Practices

## Core Directive
"No Spec, No Code." We do not guess; we implement contracts.

## The Flow
1.  **Specify (`spec.md`)**: The "What" and "Why". User requirements, success criteria.
2.  **Plan (`plan.md`)**: The "How". Technical architecture, file structure, API design.
3.  **Task (`tasks.md`)**: The "Step-by-Step". Atomic units of work.
4.  **Implement**: The Execution.

## Rules for Agents

### 1. The Specification Contract
- You must NOT write implementation code unless a corresponding `plan.md` exists and is approved.
- If a user asks for a feature not in `spec.md`, classify it as **Scope Creep** and request a spec update first.

### 2. Single Source of Truth
- The documentation in `docs/architecture/` is the truth. The code is just a projection of that truth.
- If code and docs diverge, the code is wrong.

### 3. Vibe Coding is Forbidden
- "Vibe Coding" = Coding based on intuition/improvisation rather than rigorous design.
- Always reference the specific requirement ID from `spec.md` in your commit messages and PR descriptions.
