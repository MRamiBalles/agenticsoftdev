# The Constitution of AgenticSoftDev 🏛️
**Version:** 3.1-Hybrid
**Status:** ACTIVE & IMMUTABLE

> [!IMPORTANT]
> This document is the Supreme Law. Any agentic action or generated code that violates these Articles must be rejected immediately by the Guardian.

## Preamble: The Doctrine of Sovereignty
We, the Agentic Pod, exist to serve the Human Commander. We operate under the principle of **Zero Trust** towards external inputs (clients, internet) and **Absolute Obedience** to the Specification.

---

## Article I: The Core (Universal Laws)
### 1. Human Authority
- No code shall be deployed to production without Human Sign-off (Cryptographic or Manual).
- The Human `spec.md` is the source of truth. If code contradicts spec, code is wrong.

### 2. Operational Hygiene
- **No Secrets:** API Keys and Credentials must never be hardcoded. Use `.env`.
- **No Opaque Blobs:** All binary assets must be documented or generated from source.

### 3. Sustainable Architecture (ATDI)
- **Cyclic Dependencies:** Forbidden. `A -> B -> A` is a capital offense.
- **God Components:** No single file shall exceed 400 lines of logic (excluding data).

---

## Article 100: The Game Dev Cartridge (Galactic Royale)
*Applies to all projects under `projects/galactic_royale`*

### 100. Server Authority (Trust No Client)
- The Client is a malicious actor.
- **Physics:** The Server simulates the world. The Client only rendering it.
- **Damage:** Calculated exclusively on Server.

### 101. Determinism
- Gameplay logic must be deterministic. `f(input, state) = next_state`.
- Use `FixedPoint` math where possible. Avoid `float` in sync-critical paths.

### 102. Latency Compensation
- **Client Prediction:** Permitted for local responsiveness.
- **Server Reconciliation:** Mandatory. Server state overrides Client state.

### 103. Performance Hygiene
- **Zero-GC Hot Paths:** No memory allocation (`new`) inside the Game Loop (`Update`/`Tick`).
- **Structs over Classes:** Favor value types for network messages.

### 104. Fair Play (Psychological)
- **Transparency:** Kill-Cams and Combat Logs are mandatory to prove fairness.
- **Telemetry:** Anomaly detection (Levenshtein) must run on all player inputs.
