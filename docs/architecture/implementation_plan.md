# Implementation Plan - RACI Governance Module

## Goal Description
Implement a "Dogfooding" Governance Module that enforces ISO 42001 standards within the platform. The system will distinguish between **Responsible (AI)** and **Accountable (Human)** roles, blocking deployments without explicit human cryptographic approval.

## User Review Required
> [!IMPORTANT]
> **Schema Enforcement**: The database will strictly enforce that no task can be created/saved without a `accountable_user_id`. This might break existing workflows if they create tasks anonymously.
> **Deployment Gatekeeper**: The "middleware" for deployment checking is currently simulated via database state. Actual CI/CD blocking requires integration with the specific deployment provider (e.g., GitHub Actions, Vercel). This plan covers the **Logic and State** mechanism, not the CI pipeline configuration itself.

## Proposed Changes

### Database Schema (Supabase)

#### [NEW] `task_assignments` table
- `id`: UUID (Primary Key)
- `title`: Text
- `description`: Text
- `responsible_agent`: Text (The AI Agent Name, e.g., 'Architect', 'TechLead')
- `accountable_user_id`: UUID (FK to specific user profile) **[NOT NULL]**
- `status`: Enum ('pending', 'approved', 'rejected')
- `created_at`: Timestamptz

#### [NEW] `governance_logs` table
- `id`: UUID
- `task_id`: UUID (FK to task_assignments)
- `actor_id`: UUID (FK to profiles)
- `action`: Text ('APPROVED', 'REJECTED')
- `reason`: Text
- `signed_hash`: Text (Simulated cryptographic signature of the approval)
- `timestamp`: Timestamptz

### UI Components

#### [NEW] `src/components/governance/RaciCard.tsx`
- A visual card displaying the task, the assigned AI (R), and the Human (A).
- "Traffic Light" status indicator.
- Action buttons for the Human (Approve/Reject) which trigger the signing flow.

#### [NEW] `src/pages/Governance.tsx`
- Dashboard view to see all pending approvals.

### Logic & Middleware

#### [NEW] `src/lib/governance.ts`
- Functions to handle the "signing" (hashing task data + user ID + timestamp).
- Verification function to check if a task is "deployable" (Status = Approved AND Valid Audit Log exists).

## Verification Plan

### Manual Verification
1.  **Create Task**: Try to create a task via the UI *without* an assigned human. **Expectation**: Database error / UI validation error.
2.  **Assign AI**: Assign "Agent Smith" as Responsible.
3.  **Assign Human**: Assign current user as Accountable.
4.  **Approve**: Click "Approve" on the RACI Card.
    - Check Supabase `governance_logs`: Should see a new entry with a hash.
    - Check `task_assignments`: Status should be 'approved'.
5.  **Audit**: Review the "Governance Dashboard" to see the immutable log.
