# Phase 3: Security & Isolation — Implementation Plan

**Version:** 1.0
**Date:** 2026-02-09
**Authority:** `constitution.md` Art. I (Core Laws)
**Prerequisite:** Phase 2 (Governance + ATDI) — Complete

## Objective
Blindar la ejecución de agentes mediante aislamiento en contenedores efímeros, validación pre-dispatch, logging forense y modelo de permisos por agente.

## Scope

### 1. Sandbox Runtime (`src/orchestrator/sandbox-runtime.ts`)
- Docker container lifecycle: build → run → collect stdout/stderr → destroy
- Enforced constraints: `--network none`, `:ro` mount, 30s timeout, non-root
- Resource limits: `--memory=256m`, `--cpus=0.5`
- Returns structured `SandboxResult` with exit code, output, duration

### 2. Forensic Logger (`src/orchestrator/forensic-logger.ts`)
- Implements `ForensicLogEntry` schema from `docs/governance/forensic_logging_spec.md`
- Append-only `ledger.jsonl` with SHA-256 chain linking
- Auto-redaction of secrets via `sanitizeOutput()`
- Session-scoped correlation IDs

### 3. Security Gate (`src/orchestrator/security-gate.ts`)
- Pre-dispatch validation: sanitize input, validate command whitelist
- Per-agent permission model (RBAC):
  - `architect`: PLAN_DECISION only
  - `builder`: FILE_WRITE + SHELL_EXEC (sandboxed)
  - `guardian`: READ_ONLY + AUDIT
- Post-execution output sanitization
- Integration with ATDI scoring for violations

### 4. Orchestrator Integration (`src/orchestrator/main.ts`)
- Replace `mockAgentExecution()` with real pipeline:
  `SecurityGate.validate() → SandboxRuntime.execute() → ForensicLogger.record()`
- Error handling: FAILED tasks trigger forensic log + ATDI penalty

### 5. Enhanced Dockerfile (`docker/agent_sandbox/Dockerfile`)
- Add resource limits documentation
- Add healthcheck

## File Changes
- [NEW] `src/orchestrator/sandbox-runtime.ts`
- [NEW] `src/orchestrator/forensic-logger.ts`
- [NEW] `src/orchestrator/security-gate.ts`
- [MODIFY] `src/orchestrator/main.ts`
- [MODIFY] `docker/agent_sandbox/Dockerfile`
- [NEW] `tests/security/security-gate.test.ts`
- [MODIFY] `docs/security/threat_model.md`

## Verification Strategy
- [ ] Unit tests for SecurityGate (permission checks, injection detection)
- [ ] Unit tests for ForensicLogger (chain integrity, redaction)
- [ ] Integration: Orchestrator dispatches task through full pipeline
- [ ] Manual: `docker build` + `docker run --network none` sandbox
