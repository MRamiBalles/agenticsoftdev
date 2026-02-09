# Technical Architecture Plan: Galactic Royale

> [!WARNING]
> **Constraint Check (Article 100):** This plan strictly enforces Server Authority. No client physics are trusted.

## 1. Network Topology
- **Pattern:** Authoritative Server with Client-Side Prediction (CSP).
- **Transport Layer:** 
    - **Protocol:** **Reliable UDP (RUDP)** (e.g., ENet/KCP) for entity updates. TCP forbidden for gameplay.
    - **Reliability:** Unreliable/Sequenced for movement; Reliable for events.
- **Hosting:** Dedicated Linux Headless instances managed by **Agones**.

## 2. Tech Stack Selection
- **Game Engine:** Unity (DOTS/ECS preferred for per-component physics performance).
- **Backend:** 
    - **Game Server:** Custom C# Server (Headless Unity build).
    - **Matchmaking:** **Open Match** (scalable, decoupled logic).
    - **DB:** Supabase (PostgreSQL) for User Profiles/Inventory.

## 3. Latency Compensation Strategy (The Newtonian Challenge)
*Problem:* Predicting rigid body physics with collisions is expensive to rollback.
*Solution:* 
- **Client-Side Prediction:** Client simulates local ship physics immediately.
- **Server Reconciliation:** Server runs the *true* physics @ 60Hz. If Client position error > `EPSILON` (0.5m), Server sends a correction snapshot. Client snaps visual hull to server state over `t=0.1s` (smooth correction).
- **Lag Compensation (Shooting):** Server keeps a ring buffer of past hitboxes (rewind up to 400ms). When a player fires, server rewinds world to `Time.server - Player.ping` to verify hit.

## 4. Anti-Cheat & Security (Article 100 & 104)
### 4.1. Server Authority (The Hard Truth)
- **Thrust Validation:** Server tracks max acceleration per volume. If `DeltaV > MaxThrust * dt`, input is clamped.
- **Physics Output:** Server prevents artificial velocity injection. Trusted simulation only.

### 4.2. Behavioral Telemetry (The Sociologist)
- **Anomaly Detection:** Analyze input sequences using **Levenshtein Distance**.
  - *Bot:* Distance ~0 (Perfect repetition).
  - *Human:* Distance > Threshold (Organic noise).
- **Flagging:** Auto-flag accounts with >0.8 anomaly score.

### 4.3. Psychological Fairness (Transparency)
- **Kill-Cams:** Server buffers last 5s of state. Sends "Death Replay" package to victim client.
- **Damage Logs:** Combat calculation details exposed to client for "Justice Audit".

## 5. Network & Infrastructure (Optimized)
### 5.1. Low-Latency Protocol
- **Serialization:** **FlatBuffers** (Zero-Copy, Zero-Alloc). JSON strictly forbidden for `EntityState`.
- **Bandwidth:** Delta Compression + Snapshot Interpolation to fit <50KB/s per client.

### 5.2. Scalable Orchestration
- **Game Server Lifecycle:** **Agones** (Kubernetes Custom Resources) for managing dedicated server fleets.
- **Scale Strategy:** Packed bin-packing (fill nodes first) to optimize cloud costs.
- **Performance Hygiene:** **Zero-GC** hot paths (Object Pooling & Structs).
