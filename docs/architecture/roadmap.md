# The Sovereign SDLC Platform: Roadmap & Architecture

> **Last updated:** 2026-02-09 — Reflects completion through Orchestrator Phase 4.8

## 1. Project Vision
A software development platform designed under **Spec-Driven Development (SDD)** and **ISO/IEC 42001** principles.
Unlike traditional IDEs, this platform inverts the hierarchy:
*   **The AI (Responsible - R)**: Executes the work.
*   **The Human (Accountable - A)**: Owns the critical decisions, governed by immutable contracts (Constitution) and technical debt metrics (ATDI).

## 2. System Architecture (The Agentic Core)

### Module 0: The Constitution (Static Governance)
*   **Function**: Define non-negotiable "Iron Rules".
*   **Components**: `constitution.md`, Admin Rules Editor.
*   **Status**: ✅ Completed.

### Module 1: Strategy & Market (PM Agent)
*   **Function**: Convert vague ideas into structured specifications.
*   **Flow**: `/specify` -> `spec.md` (User Journeys, Success Criteria).
*   **Status**: ✅ Completed.

### Module 2: Architecture & Planning (Architect Agent)
*   **Function**: Translate specs into safe technical plans.
*   **Flow**: `/plan` -> `plan.md`, `architecture.md`.
*   **Tools**: ATDI Calculator (Technical Debt prediction).
*   **Status**: ✅ Completed.

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

### Phase 2: The Quality Engine (✅ COMPLETED)
*   Objective: Automate technical debt review.
*   Deliverables: ATDI Calculator, Static Analysis, Quality Traffic Light.

### Phase 3: Security & Isolation Pipeline (✅ COMPLETED)
*   Objective: Sandboxed, audited agent execution.
*   Deliverables:
    *   **SecurityGate**: Pre-dispatch RBAC validation, input sanitization, command whitelist.
    *   **SandboxRuntime**: Docker container lifecycle (--network none, --read-only, 256MB, 30s timeout).
    *   **ForensicLogger**: Append-only SHA-256 chain-linked audit ledger.
*   Tests: 36 security tests passing.

### Phase 3.1: Institutional Memory — RAG (✅ COMPLETED)
*   Objective: Sovereign vector store for institutional knowledge.
*   Deliverables:
    *   **SemanticChunker**: Markdown → atomic chunks with faceted metadata.
    *   **IngestPipeline**: Constitution + ADRs → local TF-IDF 384-dim embeddings.
    *   **RetrievalService**: Cosine similarity search with RBAC.
    *   **PlanningGate**: Mandatory pre-plan consultation, contradiction detection.
    *   **ContextCompactor**: Post-session summarization → reingest.
*   Tests: 21 memory tests passing.

### Phase 4.0: DAG Orchestration Engine (✅ COMPLETED)
*   Objective: Replace linear execution with dependency-aware parallel DAG.
*   Deliverables:
    *   **DAGEngine**: Topological sort, concurrent dispatch, cycle detection.
    *   **RetryPolicy**: Per-task-type retry limits with exponential backoff + circuit breaker.
    *   **7 Agent Roles**: architect, builder, guardian, strategist, researcher, devops, designer.
    *   **9 Task Types**: PLAN, CODE, AUDIT, TEST, REVIEW, DEPLOY, RESEARCH, DESIGN, INFRA_PROVISION.
*   Tests: 33 DAG tests passing.

### Phase 4.1: Dynamic Graph Mutation (✅ COMPLETED)
*   Objective: Allow tasks to spawn child tasks at runtime.
*   Deliverables: `executeMutating()` with depth/size guards, spawn callbacks.

### Phase 4.2: Agent Communication Bus (✅ COMPLETED)
*   Objective: Typed pub/sub messaging between agents.
*   Deliverables: **EventBus** with RBAC, TTL, channel depth limits, dead-letter queue.

### Phase 4.3: Agent Negotiation Protocol (✅ COMPLETED)
*   Objective: Collective decision-making for multi-agent consensus.
*   Deliverables:
    *   **NegotiationEngine**: Proposals, votes, MAJORITY/UNANIMOUS/WEIGHTED strategies.
    *   **TaskAuction**: Capability-based bid scoring, load-aware assignment.

### Phase 4.4: Agent Learning & Adaptation (✅ COMPLETED)
*   Objective: Data-driven performance optimization.
*   Deliverables:
    *   **OutcomeTracker**: Per-agent/task-type stats with exponential decay weighting.
    *   **AdaptationEngine**: Calibrated capability scores, task affinity, adaptive retry limits.

### Phase 4.5: Persistent Execution State (✅ COMPLETED)
*   Objective: Crash recovery and forensic replay.
*   Deliverables:
    *   **CheckpointManager**: Auto-save, SHA-256 integrity, partial restore, event replay.
    *   Auto-checkpoint every N tasks, max checkpoint pruning.

### Phase 4.6: Distributed Execution (✅ COMPLETED)
*   Objective: Multi-worker task distribution.
*   Deliverables:
    *   **WorkerRegistry**: Worker lifecycle, capability tracking, heartbeat-based liveness.
    *   **LoadBalancer**: LEAST_LOADED / ROUND_ROBIN / CAPABILITY_MATCH strategies.

### Phase 4.7: Agent Self-Healing (✅ COMPLETED)
*   Objective: Autonomous failure detection and recovery.
*   Deliverables:
    *   **FailureDetector**: Classify failures (OOM, NETWORK_ERROR, TIMEOUT, DEPENDENCY_FAILURE).
    *   **HealingEngine**: Multi-strategy healing (SCALE_DOWN, RETRY_WITH_BACKOFF, ISOLATE_AND_RETRY), escalation to human.

### Phase 4.8: Simulation Sandbox (✅ COMPLETED)
*   Objective: End-to-end scenario testing without live execution.
*   Deliverables:
    *   **SimulationEngine**: Configurable scenarios (HAPPY_PATH, HEALING_RECOVERY, etc.).
    *   **ScenarioRunner**: Deterministic seeded execution with metrics collection.
*   Tests: 27 simulation tests passing.

### Orchestrator Integration (✅ COMPLETED)
*   All phases wired into `src/orchestrator/main.ts` kernel.
*   DAG callbacks → OutcomeTracker + CheckpointManager + HealingEngine.
*   11 end-to-end integration tests covering cross-subsystem flows.
*   **372 total tests passing.**

### MissionControl Dashboard (✅ COMPLETED)
*   **Orchestrator Tab**: DAG status, Agent performance, Self-healing events, Checkpoint timeline.
*   **Mission Overview Tab**: ATDI health monitor, Cone of uncertainty, Timeline feed.
*   **Live Ops Tab**: Operations log with SRE interventions.
*   **Forensic Audit Tab**: Agent reasoning timeline.
*   Simulated telemetry hook (ready for WebSocket backend).

## 4. Documentation & Knowledge Base
The platform references its own documentation as the source of truth for Agents.
*   `.ai/knowledge_base/iso42001_controls.md`: Governance rules.
*   `.ai/knowledge_base/atdi_formula.md`: Technical debt calculation.
*   `.ai/knowledge_base/moral_crumple_zones.md`: UI safety protocols.
*   `.ai/knowledge_base/sdd_manifesto.md`: Coding philosophy.

## 5. Remaining Roadmap

### Phase 5: ATDI Quality Engine Integration (🔄 NEXT)
*   Integrate ATDI scoring into orchestrator dispatch pipeline.
*   Block deployments exceeding debt threshold.

### Phase 6: Spec Versioning & Drift Detection
*   Close the `/specify` → `/plan` → `/implement` loop.
*   Detect spec changes mid-project and alert plan divergence.

### Phase 7: Frontend ↔ Orchestrator WebSocket Bridge
*   Replace simulated telemetry with live WebSocket connection.
*   Real-time DAG progress, healing events, checkpoint notifications.

### Phase 8: Advanced Intelligence (The Accessible Brain)
*   **Strategic Priority**: Explainability (XAI) via Deterministic Logic (Phase 8a) then ML (Phase 8b).
*   **Goal**: Satisfy Constitution Art I.2 ("Right to Explanation") without heavy Python infrastructure initially.
*   **Feature**: **Heuristic Risk Analysis (Deterministic SHAP)**.
    *   **Phase 8a (TypeScript)**: Calculate exact marginal contribution of files to the ATDI score (Math-based).
    *   **Phase 8b (Future)**: Full SHAP/LIME when ML models are integrated for prediction.

### Phase 9: Organizational Intelligence (v2.1 - The Sovereign Mind)
*   **Strategic Goal**: Prevent "Organizational Debt" and enforce "Agent Sovereignty".
*   **Key Pillars**:
    1.  **Organizational Debt Manager**: Inverse Conway's Law via Sociotechnical Agent.
    2.  **Advanced Agent Governance**: ISO 42001 & EU AI Act Compliance via Black Box Recorder.
    3.  **Distributed System Smells**: Graph Analysis for Hub-like & Cyclic Dependencies.
    4.  **Dynamic Planning**: Evidence-Based Scheduling with Dynamic Estimator.

### Phase 10: Fortress Security (The Shield)
*   Hard-gating deployments on security (SAST, dependency audit).

### Phase 11: Chaos Engineering
*   Fault injection into orchestrator subsystems.
*   Verify self-healing, checkpoint recovery, circuit breaker behavior under stress.
