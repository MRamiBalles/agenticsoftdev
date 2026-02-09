# Technical Architecture Plan: Galactic Royale

> [!WARNING]
> **Constraint Check (Article 100):** This plan strictly enforces Server Authority. No client physics are trusted.

## 1. Network Topology
- **Pattern:** Authoritative Server with Client-Side Prediction (CSP).
- **Transport Layer:** 
    - **Protocol:** UDP (using `ENet` or `KCP` wrapper) for Entity State updates (Pos, Rot, Vel).
    - **Reliability:** Unreliable/Sequenced for movement; Reliable for "Component Destroyed" events.
- **Hosting:** Dedicated Linux Headless instances.

## 2. Tech Stack Selection
- **Game Engine:** Unity (DOTS/ECS preferred for per-component physics performance).
- **Backend:** 
    - **Game Server:** Custom C# Server (Headless Unity build).
    - **Matchmaker:** Agones (Kubernetes) + OpenMatch.
    - **DB:** Supabase (PostgreSQL) for User Profiles/Inventory.

## 3. Latency Compensation Strategy (The Newtonian Challenge)
*Problem:* Predicting rigid body physics with collisions is expensive to rollback.
*Solution:* 
- **Client-Side Prediction:** Client simulates local ship physics immediately.
- **Server Reconciliation:** Server runs the *true* physics @ 60Hz. If Client position error > `EPSILON` (0.5m), Server sends a correction snapshot. Client snaps visual hull to server state over `t=0.1s` (smooth correction).
- **Lag Compensation (Shooting):** Server keeps a ring buffer of past hitboxes (rewind up to 400ms). When a player fires, server rewinds world to `Time.server - Player.ping` to verify hit.

## 4. Anti-Cheat Measures (Article 100 Compliance)
- **Thrust Validation:** Server tracks max acceleration per ship chassis. If `DeltaV > MaxThrust * dt`, the input is clamped or rejected.
- **Component Health:** Damage calculation is server-only. Clients only send "I fired", Server decides "You hit".
- **Speed Hacks:** Physics engine on server prevents artificial velocity injection.

## 5. Performance Hygiene (Article 103)
- **Zero-GC:** Custom struct-based networking messages (no classes). Object Pooling for projectiles and debris.
- **Tick Rate:** 60Hz Server Tick. 20Hz Network Send Rate (Interpolated on Client).
