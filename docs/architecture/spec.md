# RACI Governance System Specification

## Problem Statement
Currently, autonomous agents could deploy changes without explicit supervision. To comply with **ISO 42001**, we need a bureaucratic "emergency brake" that enforces human accountability.

## Functional Objectives

### 1. Hybrid RACI Matrix
A data structure assigning roles to each technical task.
*   **Iron Rule**: AI Agents can only be **Responsible (R)**.
*   **Iron Rule**: Only an identified Human can be **Accountable (A)**. The system must prevent saving a task without an "A" assigned.

### 2. Deployment Gatekeeper
Middleware to intercept `deployment` or `merge` attempts. It must cryptographically verify if the "Accountable" user has signed the approval.

### 3. Audit Log (ISO 42001)
Immutable record of every approval/rejection containing:
*   Timestamp
*   Human ID
*   Proposing Agent ID
*   Change Hash
*   Decision Reason

## Technical Constraints (Constitution)
*   **Database**: Supabase (PostgreSQL).
*   **Frontend**: React/Vite (shadcn-ui).
*   **No "Vibe Coding"**: Strict schema-first approach.
