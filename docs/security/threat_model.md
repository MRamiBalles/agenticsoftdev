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

## 8. Phase 4.0: DAG Orchestration Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Cyclic Dependencies (infinite loop)** | **Kahn's Algorithm** | `dag-engine.ts` validates graph before execution. Cycles = CONSTITUTIONAL VIOLATION (Art. III.1). |
| **Runaway Parallel Execution (resource exhaustion)** | **Concurrency Limiter** | `maxConcurrency: 3` cap prevents fork-bomb patterns. |
| **Retry Amplification (exponential load)** | **Circuit Breaker** | `retry-policy.ts` halts after N consecutive failures. Exponential backoff + jitter. |
| **Cascading Failures** | **Dependency Skip** | Failed task → all dependents auto-SKIPPED. No wasted sandbox cycles. |
| **Retry-based Prompt Injection** | **SecurityGate per dispatch** | Every retry passes through full SecurityGate validation. Error feedback is capped at 2000 chars. |
| **Stale Task State** | **Immutable Results** | `DAGTaskResult` is write-once per execution. Status transitions are monotonic (PENDING→READY→RUNNING→COMPLETED/FAILED). |
| **Timeout Evasion** | **Global Timeout** | `maxExecutionTimeMs` (default 5min) force-fails all remaining tasks. |

## 9. Phase 4.0 Architecture: DAG Execution Pipeline

```
buildTaskGraph() → DAGEngine.validate() → DAGEngine.execute()
                      │                      │
                      ├─ Cycle detection      ├─ Topological sort
                      └─ Missing deps check   ├─ Parallel dispatch (max 3)
                                              ├─ dispatchTask() per node:
                                              │    PlanningGate → SecurityGate → Sandbox → ForensicLog
                                              ├─ RetryPolicy.evaluate() on failure
                                              │    ├─ Error feedback injection
                                              │    ├─ Exponential backoff + jitter
                                              │    └─ Circuit breaker (threshold: 5)
                                              └─ Dependency cascade (skip on failure)
```

## 10. Phase 4.1: Dynamic Graph Mutation Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Recursive Fork Bomb (unbounded spawning)** | **Depth Limiter** | `MutationController` enforces `maxDepth: 3`. Exceeding = DEPTH_EXCEEDED rejection with Art. III.1 ref. |
| **Graph Size Explosion (memory exhaustion)** | **Graph Size Cap** | `maxGraphSize: 50` prevents runaway task accumulation. Rejected with GRAPH_SIZE_EXCEEDED. |
| **Cycle Injection via Spawn** | **Simulated Cycle Detection** | Every spawn request is validated with Kahn's algorithm on a simulated graph before injection. |
| **Duplicate Task ID Collision** | **ID Uniqueness Check** | Spawn requests with IDs already in the graph are rejected with DUPLICATE_ID. |
| **Orphan Spawns (missing dependencies)** | **Dependency Existence Check** | All declared dependencies must exist in the graph. Missing deps = MISSING_DEPENDENCY rejection. |
| **Context Cross-Contamination** | **Context Isolation** | Spawned tasks receive only: parent output (capped 500 chars) + declared payload. No sibling or global state access. |
| **Privilege Escalation via Spawn** | **RBAC on Mutation Policy** | `enforceRBAC` flag enables permission checks on spawned task types (SecurityGate validates each dispatch). |
| **Spawn-based Prompt Injection** | **SecurityGate per Task** | Every spawned task passes through the full SecurityGate pipeline on dispatch (input sanitization + RBAC + payload size). |

## 11. Phase 4.1 Architecture: Mutating DAG Pipeline

```
DAGEngine.executeMutating() → MutationController.evaluate() → Graph Injection
    │                              │                              │
    ├─ Standard DAG execution      ├─ Depth check (max 3)        ├─ DAGTask created with:
    ├─ MutatingTaskDispatcher      ├─ Graph size check (max 50)  │    depth = parent.depth + 1
    │    returns TaskDispatchResult ├─ Duplicate ID check         │    parentId = parent.id
    │    with optional SpawnReq[]  ├─ Dependency existence        │    _parentContext (isolated)
    ├─ Spawns processed ONLY       ├─ Simulated cycle detection   └─ Status = PENDING (re-enters scheduler)
    │    after parent COMPLETES    └─ RBAC validation
    └─ Callbacks: onSpawn / onSpawnRejected
```

## 12. Phase 4.2: Agent Communication Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Context Bombing (oversized messages)** | **Message Size Limit** | `EventBus` enforces `maxMessageSize: 10KB`. Exceeding = MESSAGE_TOO_LARGE rejection. |
| **Bus Flooding (message DoS)** | **Total Message Cap** | `maxTotalMessages: 1000` with FIFO eviction. Oldest messages auto-purged. |
| **Unauthorized Broadcast** | **RBAC on Publish** | Only `architect` and `strategist` can publish to `agent.broadcast`. All roles checked per topic prefix. |
| **Eavesdropping (cross-agent leakage)** | **Targeted Messages** | Direct messages (`target` field) only delivered to the named subscriber. Others filtered out. |
| **Stale Message Poisoning** | **Message TTL** | Default 60s TTL. Expired messages excluded from `getMessages()`. `purgeExpired()` cleans log. |
| **Subscription Leaks (zombie listeners)** | **Mailbox Dispose** | `AgentMailbox.dispose()` cleans all subscriptions. Scoped per-task lifecycle. |
| **Bus State Corruption** | **Append-Only Log** | Message log is append-only. No mutation of published messages. All activity forensically logged. |
| **Coordination Deadlock (barrier starvation)** | **Barrier Design** | Barriers are opt-in with explicit participant count. Non-blocking `isRaised()` check on signals. |

## 13. Phase 4.2 Architecture: Agent Communication Pipeline

```
EventBus (in-process pub/sub)
    │
    ├─ publish(topic, sender, role, payload)
    │    ├─ Size check (max 10KB)
    │    ├─ RBAC check (role → topic prefix)
    │    ├─ Message stored in append-only log
    │    ├─ FIFO eviction (max 1000 messages)
    │    └─ Deliver to matching subscribers (exact + wildcard)
    │
    ├─ subscribe(topic, subscriber, role, handler)
    │    ├─ RBAC check (role → topic prefix)
    │    └─ Wildcard support (e.g., 'task.*')
    │
    ├─ AgentMailbox (scoped per-agent view)
    │    ├─ send() → publish with agent identity
    │    ├─ on() → subscribe with auto-cleanup
    │    ├─ inbox() → messages targeted to this agent
    │    └─ dispose() → unsubscribe all
    │
    └─ Coordination Primitives
         ├─ Barrier: N participants must arrive() before wait() resolves
         └─ SignalFlag: one-shot raise()/wait() notification

ForensicLogger ← onPublish / onReject callbacks log all bus activity
```

## 14. Phase 4.3: Agent Negotiation Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Vote Manipulation (double voting)** | **Immutable Votes** | Each voter can cast exactly one vote per proposal. Duplicate = `ALREADY_VOTED` rejection. |
| **Unauthorized Veto (privilege escalation)** | **VETO Role Restriction** | Only `guardian` and `strategist` can cast VETO. Others = `VETO_NOT_PERMITTED`. |
| **Sybil Attack (fake voters)** | **Eligible Voter List** | Proposals declare eligible voters at creation. Non-eligible = `NOT_ELIGIBLE` rejection. |
| **Stalled Proposals (deadlock)** | **Configurable Timeout** | Proposals auto-expire after `timeoutMs` (default 5s). `checkTimeout()` triggers EXPIRED status. |
| **Auction Bid Manipulation** | **Input Validation** | Capability (0-100), load (0-100), duration (>0) enforced. Invalid ranges rejected. |
| **Auction Sniping (last-second bid)** | **Single Bid Rule** | Each agent can bid once per auction. `ALREADY_BID` prevents re-bidding. |
| **Weighted Vote Abuse** | **Fixed Role Weights** | Weights are hardcoded (architect:3, strategist:2, others:1). Not configurable at runtime. |
| **Decision Opacity** | **Full Tally Transparency** | `ConsensusResult` includes full vote tally, weighted tally, veto attribution. All published to EventBus. |

## 15. Phase 4.3 Architecture: Negotiation Pipeline

```
NegotiationEngine
    │
    ├─ propose(proposer, description, options, strategy)
    │    ├─ Creates Proposal (OPEN status)
    │    └─ Publishes to 'negotiation.propose' via EventBus
    │
    ├─ vote(proposalId, voter, role, choice)
    │    ├─ Eligibility check (voter list)
    │    ├─ Duplicate check (immutable votes)
    │    ├─ VETO permission check (guardian/strategist only)
    │    ├─ Choice validation (must be in options or ABSTAIN/VETO)
    │    ├─ Auto-resolve on quorum
    │    └─ Publishes to 'negotiation.vote' via EventBus
    │
    ├─ resolve() → ConsensusResult
    │    ├─ MAJORITY: >50% of non-abstain votes
    │    ├─ UNANIMOUS: all non-abstain agree
    │    ├─ WEIGHTED: role-based weights (arch:3, strat:2, rest:1)
    │    ├─ VETO: immediate block by guardian/strategist, else majority
    │    └─ Publishes to 'negotiation.result' via EventBus
    │
    └─ checkTimeout() → auto-EXPIRED if past deadline

TaskAuction
    │
    ├─ create(taskId, taskType, initiator)
    ├─ bid(auctionId, bidder, role, capability, load, duration)
    │    └─ Validates ranges, prevents duplicates
    └─ close() → AuctionResult
         ├─ Score = capability(40%) + availability(30%) + speed(30%)
         └─ Tie-break by role priority (architect > strategist > builder > ...)
```

## 16. Phase 4.4: Agent Learning & Adaptation Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Learning Poisoning (false outcomes)** | **Outcome Integrity** | Outcomes recorded only from DAG engine callbacks (system-generated). Agents cannot self-report. |
| **Stale Learning (concept drift)** | **Exponential Decay** | Recent outcomes weighted higher via configurable half-life (default 1h). Old data naturally fades. |
| **Recommendation Manipulation** | **Minimum Data Threshold** | Recommendations require ≥5 outcomes. Prevents gaming from sparse data. |
| **Runaway Adaptation (feedback loop)** | **Bounded Recommendations** | Retry suggestions capped at 0–3. Capability scores bounded 0–100. No unbounded growth. |
| **Profile Data Explosion** | **Rolling Window** | Max 50 outcomes per agent+taskType pair. FIFO eviction. Constant memory footprint. |
| **Opaque Adaptation Decisions** | **Full Transparency** | All recommendations include description, confidence score, and suggested value. Logged via callbacks. |
| **Failure Pattern False Positives** | **Alert Threshold** | Failure alerts require ≥3 occurrences of same error pattern. Reduces noise. |
| **Biased Task Routing** | **Affinity as Suggestion** | Task affinity is advisory (>80% success required). Does not override RBAC or explicit assignment. |

## 17. Phase 4.4 Architecture: Learning Pipeline

```
DAGEngine callbacks (onComplete/onFail)
    │
    └─ OutcomeTracker.record(TaskOutcome)
         ├─ Rolling window (max 50 per agent+taskType)
         ├─ Exponential decay weighting (half-life: 1h)
         └─ computeStats() → PerformanceStats
              ├─ Success rate (weighted)
              ├─ Avg/p95 duration
              ├─ Retry success rate
              └─ Error pattern frequency

AdaptationEngine.recommend(agent, role)
    ├─ RETRY_TUNE: retry success < 20% → suggest 0 retries
    ├─ BID_CALIBRATE: capability = success_rate × 100, duration = p95
    ├─ TASK_AFFINITY: agent excels at type (>80% success) → prioritize
    └─ FAILURE_ALERT: error pattern ≥ 3x → flag for human review

Integration Points:
    ├─ getCalibratedCapability() → TaskAuction.bid()
    ├─ getCalibratedDuration() → TaskAuction.bid()
    ├─ getSuggestedRetryLimit() → RetryPolicy
    └─ getTaskAffinity() → task routing decisions
```

## 18. Phase 4.5: Persistent Execution State Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Checkpoint Tampering** | **SHA-256 Integrity** | Every checkpoint stores a SHA-256 hash of the serialized snapshot. `INTEGRITY_VIOLATION` on mismatch. |
| **Stale State Replay (time-travel attack)** | **Version Field** | Snapshots include `version` for forward compatibility. Old formats detectable. |
| **Checkpoint Flooding (disk exhaustion)** | **Auto-Pruning** | `maxCheckpoints: 10` with FIFO eviction. Oldest checkpoints auto-deleted. |
| **Partial State Corruption** | **Atomic Serialization** | Full snapshot serialized as single JSON blob. No partial writes. Deserialization fails cleanly. |
| **Resume with Stale Credentials** | **No Secret Persistence** | Checkpoints serialize task state only. No API keys, tokens, or secrets in snapshots. |
| **Replay Injection (fake events)** | **Read-Only Replay** | `ExecutionReplay` is pure read — emits events via callbacks, no side effects, no re-execution. |
| **Re-queue Amplification** | **Status-Based Restore** | Only PENDING/READY/RUNNING tasks re-queued. COMPLETED/FAILED/SKIPPED preserved as-is. |

## 19. Phase 4.5 Architecture: Persistence Pipeline

```
DAGEngine execution
    │
    ├─ CheckpointManager.notifyTaskCompleted()
    │    └─ Auto-checkpoint every N tasks (default: 5)
    │
    ├─ CheckpointManager.save()
    │    ├─ serializeGraph() → SerializedGraph (Map → Array)
    │    ├─ Capture: executionOrder, retries, spawned, outcomes, messages
    │    ├─ SHA-256 hash of JSON payload
    │    ├─ Store in memory (Map<id, Checkpoint>)
    │    └─ Auto-prune oldest (max 10 retained)
    │
    ├─ CheckpointManager.load(id) → RestoreResult
    │    ├─ Verify SHA-256 integrity
    │    ├─ deserializeGraph() → DAGGraph (Array → Map)
    │    ├─ COMPLETED/FAILED/SKIPPED → preserved
    │    └─ PENDING/READY/RUNNING → re-queued as PENDING
    │
    └─ ExecutionReplay.replay(snapshot) → ReplayEvent[]
         ├─ DISPATCH / COMPLETE / FAIL events per task
         ├─ SPAWN events for parent-child relationships
         ├─ MESSAGE events from bus log
         ├─ OUTCOME events from learning tracker
         └─ Sequential indices for forensic ordering
```

## 20. Phase 4.6: Distributed Execution Risks

| Threat | Defense Layer | Implementation |
| :--- | :--- | :--- |
| **Rogue Worker (malicious node)** | **Capability Registration** | Workers declare capabilities at registration. Tasks only dispatched to capable workers. |
| **Worker Death Mid-Task** | **Heartbeat + Failover** | Workers send heartbeats every 5s. 3 misses → DEAD. Tasks re-dispatched to healthy worker (max 2 failover attempts). |
| **Dispatch Timeout (hung worker)** | **Per-Task Timeout** | Default 30s timeout per dispatch. Timeout → failover to different worker. |
| **Fork Bomb (worker overload)** | **Concurrency Cap** | `maxConcurrency` per worker. Workers at capacity excluded from candidate pool. |
| **Stale Worker State** | **DRAINING Protocol** | Workers set to DRAINING finish current tasks but accept no new ones. Clean lifecycle transitions. |
| **Failover Amplification** | **Attempt Limit** | Max 2 failover attempts per task. Exhausted → null result (task fails cleanly). |
| **Worker Impersonation** | **Registry Control** | Only the orchestrator registers workers. No self-registration from untrusted sources. |
| **Load Imbalance** | **3 LB Strategies** | ROUND_ROBIN, LEAST_LOADED, CAPABILITY_MATCH. Hot-swappable at runtime. |

## 21. Phase 4.6 Architecture: Distributed Execution Pipeline

```
WorkerRegistry
    ├─ register(id, capabilities, maxConcurrency)
    ├─ heartbeat(workerId) → updates lastHeartbeat
    ├─ checkHeartbeats() → marks DEAD workers (3 missed @ 5s)
    ├─ drain(workerId) → DRAINING (no new tasks)
    └─ getCapableWorkers(taskType) → available + capable

LoadBalancer
    ├─ ROUND_ROBIN: simple rotation
    ├─ LEAST_LOADED: fewest activeTasks / maxConcurrency
    └─ CAPABILITY_MATCH: filter by capability → least loaded

DistributedDispatcher
    ├─ dispatch(task)
    │    ├─ getCapableWorkers(task.type)
    │    ├─ LoadBalancer.select(candidates)
    │    ├─ executeWithTimeout(worker, task, 30s)
    │    ├─ On success → DispatchResponse
    │    └─ On failure → exclude worker → failover (max 2)
    └─ Failover log → forensic record of all re-dispatches
```

*Policy: "Security is not a feature; it is a constraint. Memory is not a luxury; it is a necessity. Autonomy without resilience is recklessness."*
