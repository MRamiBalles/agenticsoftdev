# Threat Model: Sovereign SDLC Platform

**Version:** 1.0
**Date:** 2026-02-08
**Scope:** Governance & Codebase Integrity

## 1. Assets protected
*   **Infrastructure Secrets**: API Keys (OpenAI, Supabase), Database URLs.
*   **Code Integrity**: Protection against malicious injection or accidental vulnerabilities.
*   **Governance Data**: ensuring the immutability of `governance_logs` (RACI audit trail).

## 2. Threat Actors
*   **The "Hallucinating" Agent**: An AI agent that accidentally invents insecure code patterns (e.g., hardcoded secrets, SQL injection).
*   **The "Lazy" Human**: A developer bypassing security checks for speed.
*   **Supply Chain Attacks**: Compromised npm dependencies.

## 3. Defense Mechanisms (The Shield)

| Threat | Defense Layer | Implementation (Tool) |
| :--- | :--- | :--- |
| **Hardcoded Secrets** | **SAST (Static Analysis)** | `scripts/analyze_security.ts` (Pattern Matching / ESLint Security) |
| **Injection Attacks (XSS/SQLi)** | **SAST** | `eslint-plugin-security` rules against `eval()`, `dangerouslySetInnerHTML` |
| **Vulnerable Dependencies** | **SCA (Composition Analysis)** | `scripts/security/dependency_firewall.ts` (Allowlist + npm audit) |
| **Governance Bypass** | **Constitutional Block** | ATDI Penalty (+500 pts) locks the Dashboard UI. |
| **Prompt Injection** | **Input Sanitizer** | `scripts/security/input_sanitizer.ts` (Regex + Whitelist) |
| **Agent Privilege Escalation** | **RBAC Security Gate** | `src/orchestrator/security-gate.ts` (Per-agent permission model) |
| **Destructive Agent Execution** | **Sandbox Runtime** | `src/orchestrator/sandbox-runtime.ts` + `docker/agent_sandbox/Dockerfile` |
| **Secret Exfiltration (Output)** | **Output Sanitizer** | `sanitizeOutput()` in Security Gate post-execution |
| **Forensic Accountability** | **Flight Recorder** | `src/orchestrator/forensic-logger.ts` (SHA-256 chain-linked ledger) |
| **Context Bombing (DoS)** | **Payload Size Guard** | Security Gate: 100KB max payload limit |

## 4. Risk Scoring (ATDI Integration)
Security risks are treated as **Critical Architectural Debt**.
*   **Critical Vulnerability**: +500 ATDI (Immediate Block).
*   **High Vulnerability**: +100 ATDI (Block).
*   **Medium Vulnerability**: +50 ATDI (Warning).

## 5. Phase 3.1: Memory Poisoning Defense (Protocolo Mnemosyne)

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Memory Poisoning (false precedents)** | **RBAC Write Control** | Builder/Guardian are READ-ONLY on `knowledge_vectors`. Only Architect/Strategist/Human can write. |
| **Stale/Deprecated Decisions** | **Status Filtering** | Deprecated ADRs excluded from search results at both application and DB (RLS) level. |
| **Context Rot (noise accumulation)** | **Context Compactor** | `context-compactor.ts` summarizes sessions into high-signal chunks, discarding raw logs. |
| **Architectural Drift (re-litigation)** | **Planning Gate** | `planning-gate.ts` mandates pre-plan RAG consultation. Contradictions trigger INTERRUPT. |
| **Document Tampering** | **Hash Verification** | `source_hash` (SHA-256) stored per chunk; re-ingestion detects changes. |
| **Prompt Injection via Memory** | **Input Sanitizer** | All retrieved chunks pass through `sanitizeInput()` before prompt injection. |

## 6. Phase 3 Architecture: Security Pipeline

```
Task → SecurityGate.validate() → SandboxRuntime.execute() → ForensicLogger.record()
         │                          │                          │
         ├─ RBAC check              ├─ --network none          ├─ SHA-256 chain
         ├─ Input sanitization      ├─ --memory 256m           ├─ Secret redaction
         ├─ Command whitelist       ├─ --cpus 0.5              ├─ Session correlation
         └─ Payload size guard      ├─ --read-only             └─ ISO 42001 compliance
                                    ├─ non-root user
                                    └─ 30s timeout
```

## 7. Phase 3.1 Architecture: Memory Pipeline

```
Boot → IngestPipeline.ingest() → SemanticChunker → LocalEmbedding → RetrievalService
         │                          │                    │                │
         ├─ constitution.md         ├─ Section-based     ├─ TF-IDF 384d   ├─ Cosine similarity
         ├─ docs/adr/*.md           ├─ Facet extraction   ├─ Sovereign     ├─ RBAC enforcement
         └─ docs/decisions/*.md     ├─ Domain detection   └─ No external   ├─ Deprecated filter
                                    └─ Impact scoring        API calls    └─ Context assembly

Dispatch (PLAN) → PlanningGate.quickConsult() → Contradiction Detection → Context Injection
                    │                              │                        │
                    ├─ Keyword extraction           ├─ Tech mandate check    ├─ institutional_context
                    ├─ RAG query                    ├─ Prohibition check     └─ mandatory_constraints
                    └─ Constraint extraction         └─ INTERRUPT on critical

Shutdown → ContextCompactor.compact() → Session Summary → RetrievalService.ingestChunks()
```

*Policy: "Security is not a feature; it is a constraint. Memory is not a luxury; it is a necessity."*
