# 🗳️ Playbook: Audit Export (PROTOCOL-003)

**Trigger:** External Audit Request (EU AI Act, ISO 42001) or Internal Investigation.
**Severity:** MEDIUM

## 1. Compliance Check
Run the "Forensic Audit" to verify chain of custody.
```bash
sov audit
```

## 2. Export Evidence Package
The system maintains a cryptographically chained ledger. To export it for a 3rd party auditor:

1.  **Locate Ledger:** `.ai/audit/ledger.jsonl`
2.  **Verify Hashes:** Run `scripts/governance/verify_chain.ts` (if implemented) or check manually.
3.  **Package:**
    *   `ledger.jsonl` (The immutable log)
    *   `constitution.md` (The rules engine)
    *   `docs/decisions/*.md` (The reasoning)

## 3. Human Sign-Off
The exported package must be signed by the Accountable Human.

> "I certify availability and integrity of these logs."
> -- Manu, Architect.
