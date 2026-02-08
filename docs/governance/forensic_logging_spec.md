# Forensic Logging Specification (ISO 42001)

**Version:** 1.0
**Authority:** `constitution.md` Art. I.2 (Right to Explanation)
**Purpose:** Ensure traceability and accountability of AI Agent actions.

## 1. The "Black Box" Standard
Every critical action taken by an Agent must be recorded in the **Flight Recorder**.
A "Critical Action" is defined as:
*   Modifying code (Filesystem Write).
*   Executing a command (Shell Execution).
*   Making an irreversible decision (Architectural Choice).

## 2. Schema Definition (`ledger.jsonl`)
Each log entry is an immutable JSON object appended to `.ai/audit/ledger.jsonl`.

```typescript
interface ForensicLogEntry {
  // Integrity
  id: string; // UUID v4
  timestamp: string; // ISO 8601
  previous_hash: string; // SHA-256 of the previous entry (Blockchain-style linking)
  
  // Identity
  agent_id: string; // e.g., "ArchitectAgent-v2.1"
  session_id: string; // Logic session correlation ID

  // Context (Input)
  trigger_event: string; // e.g., "User Request: /implement auth"
  context_snapshot_hash: string; // Hash of the input state

  // Reasoning (The "Why")
  chain_of_thought: string; // The confusing logic/monologue of the LLM. 
                            // MUST be captured from <thinking> tags if available.

  // Action (The "What")
  action_type: "FILE_WRITE" | "SHELL_EXEC" | "PLAN_DECISION";
  action_payload: any; // The arguments passed to the tool

  // Validation
  outcome: "SUCCESS" | "FAILURE" | "BLOCKED";
  governance_check_ref?: string; // Link to ATDI/Security check ID
}
```

## 3. Implementation Requirements
1.  **Immutability:** The file `.ai/audit/ledger.jsonl` is append-only.
2.  **Redaction:** ANY secret detected by the Security Shield (Phase C) found in `action_payload` or `chain_of_thought` must be replaced with `[REDACTED]`.
3.  **Human Readable:** The log is structured JSON, but the Dashboard must render it as a timeline capable of "rewinding" the decision.

## 4. Compliance Mapping
*   **ISO 42001 A.6.2.8:** Event logs recording user activities, exceptions, and information security events.
*   **EU AI Act Art. 19:** Automatically generated logs for high-risk AI systems.
*   **Moral Crumple Zone:** Provides the evidence that the human `Accountable` reviewed the `chain_of_thought` before signing.
