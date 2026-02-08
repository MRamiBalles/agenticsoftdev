# The Sovereign SDLC Platform: Roadmap & Architecture

## 1. Project Vision
A software development platform designed under **Spec-Driven Development (SDD)** and **ISO/IEC 42001** principles.
Unlike traditional IDEs, this platform inverts the hierarchy:
*   **The AI (Responsible - R)**: Executes the work.
*   **The Human (Accountable - A)**: Owns the critical decisions, governed by immutable contracts (Constitution) and technical debt metrics (ATDI).

## 2. System Architecture (The Agentic Core)

### Module 0: The Constitution (Static Governance)
*   **Function**: Define non-negotiable "Iron Rules".
*   **Components**: `constitution.md`, Admin Rules Editor.
*   **Status**: ✅ Designed.

### Module 1: Strategy & Market (PM Agent)
*   **Function**: Convert vague ideas into structured specifications.
*   **Flow**: `/specify` -> `spec.md` (User Journeys, Success Criteria).
*   **Status**: 🔄 In Progress.

### Module 2: Architecture & Planning (Architect Agent)
*   **Function**: Translate specs into safe technical plans.
*   **Flow**: `/plan` -> `plan.md`, `architecture.md`.
*   **Tools**: ATDI Calculator (Technical Debt prediction).
*   **Status**: 🚧 Next Phase.

### Module 3: Construction (Coding Swarm)
*   **Function**: Execute the plan without deviation ("Vibe Coding" prohibited).
*   **Flow**: `/tasks` -> `/implement`.
*   **Status**: ✅ Active (Dogfooding).

### Module 4: Deployment & Governance (CISO/Ops Agent)
*   **Function**: Change control and forensic audit.
*   **Components**:
    *   **RACI Matrix**: `task_assignments` table enforcing Human Accountability.
    *   **Audit Log**: `governance_logs` table with crypto-hashing.
    *   **Control Card**: UI blocking approval without justification.
*   **Status**: ✅ Completed & Verified.

## 3. Implementation Roadmap

### Phase 1: Governance Foundation (✅ COMPLETED)
*   Objective: Prevent AI from acting without supervision.
*   Deliverables: Supabase Tables (RACI/Logs), SQL Iron Rules, Approval UI.
*   Validation: Manual Dogfooding (Failed "Empty Justification" test, Failed "Agent Accountability" test).

### Phase 2: The Quality Engine (🚧 NEXT UP)
*   Objective: Automate technical debt review.
*   Deliverables:
    *   Static Analysis Integration (Arcan/Custom Script).
    *   **ATDI Calculation**: Index based on Architectural Smells (Cycles, Hubs).
    *   **Quality Traffice Light**: Visual indicator in the Governance Card.
*   Tests:
    *   "God Component" Simulation (Verify auto-block).
    *   Explainability Check (Verify AI explanation of rejection).

### Phase 3: Full SDD Flow
*   Objective: Close the loop `/specify` -> `/plan` -> `/implement`.
*   Deliverables: Mission Control Chat Interface, Spec/Plan Version Management.
*   Tests: Drift Detection (Change spec mid-project and verify plan alert).

## 4. Documentation & Knowledge Base
The platform references its own documentation as the source of truth for Agents.
*   `.ai/knowledge_base/iso42001_controls.md`: Governance rules.
*   `.ai/knowledge_base/atdi_formula.md`: Technical debt calculation.
*   `.ai/knowledge_base/moral_crumple_zones.md`: UI safety protocols.
*   `.ai/knowledge_base/sdd_manifesto.md`: Coding philosophy.

## 5. Vision v2.0: The Sovereign Memory
Building the "Project Brain" to enable self-healing and learning.

### A. Project Constitution (✅ STARTED)
*   **Goal**: Ensure every agent prompt is grounded in immutable rules.
*   **Deliverable**: `constitution.md` (The "System of Quality").

### B. Mission Control Dashboard
*   **Goal**: Visualize the state of the project beyond simple tasks.
*   **Features**:
    *   **Debt Thermometer**: Real-time ATDI gauge.
    *   **Con of Uncertainty**: Visualization of project risk reducing over time.
    *   **Sovereign Chat**: Native interface to interact with Agents (Modify Spec, Request Audits).

### C. Self-Healing Pipelines (SRE Agent)
*   **Goal**: Autonomous incident response.
*   **Scenario**: Test fails -> Agent analyzes log -> Agent proposes fix -> Guardian validates -> Human approves.

