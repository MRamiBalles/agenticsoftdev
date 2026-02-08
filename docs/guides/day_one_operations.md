# Day One Operations Guide: Sovereign SDLC Platform 📘⚓

**Welcome, Commander.** This guide ensures you can operate the platform safely from Day 1.

## 1. The Hierarchy of Command (RACI)
You are entering a constitutional monarchy where:
*   **You (Accountable):** Hold the "Nuclear Codes" (Private Key). You answer to the Board/Law.
*   **Governance Agent (Gatekeeper):** Enforces the *Constitution*. He will block you if you violate the rules.
*   **SRE Agent (Shield):** Protects the system stability. He will revert your commits if they break the build.

## 2. Emergency Protocols ("Break Glass") 🔨
If the Governance Agent blocks a critical hotfix due to a "False Positive" (e.g., ATDI Spike), follow this procedure:

1.  **Generate a Justification Token:**
    ```bash
    npx tsx scripts/governance/sign_off.ts --action="force_deploy" --reason="Critical Security Fix CVE-2025-XYZ"
    ```
2.  **Verify the Log:**
    Check `.ai/audit/flight_recorder.log`. Your action is now permanently recorded as an "Executive Override".

## 3. Routine Hygiene Rituals 🧹
To prevent "Digital Atrophy", run the cleanup scanner every Monday:

```bash
npx tsx scripts/utils/health_check.ts
```

*   **Green:** No action needed.
*   **Yellow (Atrophy):** Provide a `deprecation_list.json` to the Value Agent.
*   **Red (Hubs):** Halt feature work. Launch a `/plan refactor` mission immediately.

## 4. First Mission
To verify your command, run a harmless "Ping" to the constitution:

```bash
npx tsx scripts/governance/check_constitution.ts --action="ping" --signature="[YOUR_NAME]"
```

*Good hunting.* 🦅
