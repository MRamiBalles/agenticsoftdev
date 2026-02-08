# ☣️ Playbook: Toxic Code Incident (PROTOCOL-001)

**Trigger:** Sovereign SRE triggers an Auto-Revert due to critical failure (Cycle detected, Test failure).
**Severity:** HIGH

## 1. Immediate Action
The system has likely already reverted the commit. Verify status:
```bash
sov status
```

## 2. Diagnosis
Check the `flight_recorder` logs to understand why the agent was blocked.
```bash
tail -n 50 .ai/audit/ledger.jsonl
```

## 3. Resolution Options

### Option A: Fix Forward (Standard)
1.  Pull the reverted state.
2.  Fix the issue locally.
3.  Commit with a new message responding to the error.

### Option B: Break Glass (Emergency Override)
**WARNING:** This requires Human Accountability Signature.
If the code MUST bypass the checks (e.g., a cycle is temporary/necessary for a migration):

1.  Use the `FORCE` flag in the commit message (requires `SIG-HUMAN`).
2.  Example: `git commit -m "feat: critical hotfix [FORCE:SIG-HUMAN-Manu-2026]"`
3.  **Audit:** The Governance Agent will log this as a "Constitutional Bypass" and alert the Dashboard.

## 4. Post-Mortem
Run a health check to ensure no lasting damage.
```bash
sov doctor
```
