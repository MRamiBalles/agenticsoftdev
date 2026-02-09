# 🦅 Operation Strategic Alignment: Pod Briefing

## 🧠 To: The Strategist (Product Manager)
**Subject:** Psychological Fairness & Transparency Specs

Commander's intent prioritizes **Trust** as a core mechanic. Update your `spec.md` mental model:
- **New Feature:** "Justice Audit". Players must be able to see the math behind their death.
- **Requirement:** Kill-Cams are not optional. They are a "Trust artifact".
- **Metric:** Success involves reducing "Hack Accusations" by 50% via transparency.
- **Action:** Ensure `task_ops.md` stories reflect "As a Victim, I want to see how I died..."

---

## 🏛️ To: The Architect (Systems & Netcode)
**Subject:** Infrastructure Overhaul (Agones & RUDP)

The "Standard Unity Networking" is deprecated. We are moving to **Sovereign Infrastructure**:
- **Protocol:** **Reliable UDP (RUDP)**. TCP is strictly forbidden for gameplay packets.
- **Serialization:** **FlatBuffers** only. No JSON in the hot path.
- **Orchestration:** Adopt **Agones** (K8s CRDs) for game server lifecycle.
- **Action:** Design the `NetworkProtocol.cs` to be zero-copy compatible.

---

## 🧱 To: The Builder (Gameplay & Engine)
**Subject:** Implementation Constraints (Zero-GC & Telemetry)

You are now operating under strict **Article 103 (Performance)** and **Article 100 (Authority)** constraints:
- **Zero-GC:** Do not use `new` inside `Update()`. Use `ObjectPooling`.
- **Structs:** Use `struct` for all network messages (`PlayerInput`, `StateSnapshot`).
- **Telemetry Hook:** You must capture every input frame into a ring buffer for the *Sociologist* to analyze.
- **Action:** Implement `InputTelemetry.cs` immediately.

---

## 🛡️ To: The Guardian (SRE & QA)
**Subject:** New Constitutional Articles (100-104)

Your audit checklist has expanded. You must now reject PRs that violate:
- **Art. 100:** Client-side damage calculation (Immediate Rejection).
- **Art. 103:** Memory allocations in hot paths.
- **Art. 104:** Lack of logging for combat calculations.
- **Action:** Update your `check_constitution.ts` script to grep for `new ` inside `Update()` methods.

---

## 📡 To: The Sociologist (Behavioral Analysis)
**Subject:** Bot Detection Strategy

We are deploying a "Turing Test" for gameplay inputs:
- **Method:** **Levenshtein Distance** analysis on input sequences.
- **Hypothesis:** Bots have low entropy (perfect repetition). Humans have high entropy (noise).
- **Action:** Design the threshold curves for "Flagging" vs "Banning".
