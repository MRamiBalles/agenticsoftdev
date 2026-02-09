# AGENTS.md: The Agentic Protocol

> [!IMPORTANT]
> **To all AI Agents:** This is your "Flight Manual". You must read this before modifying any code or documentation in this repository.

## 1. Top-Level Directory Structure (Canonical Map)
*   `src/orchestrator/`: **The Core**. Contains the graph execution engine. Do not modify unless you are the *Core Engineer*.
*   `src/agents/`: **The Workforce**. Definitions of agent personas (Architect, Builder, etc.).
*   `src/core/memory/`: **The Hippocampus**. Long-term storage for ADRs and context.
*   `projects/<project_name>/`: **Domain Sandboxes**. Where specific projects (like games) live.
*   `docs/governance/`: **The Law**. Constitution and audit logs.

## 2. Context Contracts (Tiered Memory)
To prevent "Context Rot", adhere to these tiers:

| Tier | Artifact | Persistence | Who Needs It? |
| :--- | :--- | :--- | :--- |
| **LTM (Long-Term)** | `spec.md`, `constitution.md`, `AGENTS.md` | Permanent | **All Agents**. Read on startup. |
| **MTM (Medium-Term)** | `plan.md`, `ADRs` | Project Lifecycle | **Architect & Builder**. Consult before design decisions. |
| **STM (Short-Term)** | `tasks.md`, Current Source Code | Task Lifecycle | **Builder & Guardian**. Read only relevant files. |

**Rule:** Do not load `src/` recursively into context. Read only what you strictly need (Principle of Least Privilege).

## 3. Forbidden Patterns (The "Anti-Patterns")
*   **Vibe Coding:** Generating code without updating `plan.md` first.
*   **Context Dumping:** Pasting entire file contents into chat when a summary suffices.
*   **Ghost Dependencies:** Importing libraries that are not in `package.json` without adding them.
*   **Hardcoded Secrets:** Never request or generate API keys in artifacts.

## 4. Technical Constraints (Performance & Security)
*   **Zero-Alloc Hot Paths:** In Game Loops (`Update`), use object pooling. No `new` keywords.
*   **Server Authority:** For Multiplayer, clients are untrusted observers. Logic runs on Server.
*   **Sanitized Inputs:** All IO must be validated against a schema (Zod/structs) before processing.

## 5. Validation Commands
*   **Run Audit:** `npm run audit:governance`
*   **Check Constitution:** `npx tsx scripts/governance/check_constitution.ts`
*   **Lint:** `npm run lint`

---
*Verified by The Strategist - 2026*
