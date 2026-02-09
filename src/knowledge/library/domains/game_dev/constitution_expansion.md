# Constitution Extension: Multiplayer Game Development (v1.0)

> [!IMPORTANT]
> This document extends the Sovereign Core Constitution. All clauses herein are mandatory for Game Development projects.

## Article 100: Server Authority (Anti-Cheat Doctrine)
1.  **Trust No Client:** The server is the single source of truth for game state. Clients are mere "dumb terminals" that send inputs and render the interpolated state.
2.  **Input Validation:** All client inputs (`Move(x,y)`, `Shoot(vector)`) must be sanitized and validated on the server frame-by-frame. No "teleportation" allowed.
3.  **State Reconciliation:** The server has the final say. If a client predicts a movement that the server rejects, the client must snap back (reconcile) to the server's truth.

## Article 101: Determinism & Simulation Fidelity
1.  **Deterministic Lockstep (If applicable):** For RTS/Fighting games, the simulation must yield identical results for identical inputs on all machines. Avoid floating-point non-determinism.
2.  **Frame Rate Independence:** Game logic simulation (physics, movement) must be decoupled from rendering frame rate (`DeltaTime`). Use fixed time steps for physics.

## Article 102: Latency & Network Budget
1.  **Prediction Policy:** Implement Client-Side Prediction for local player movement to ensure responsiveness, but always validate server-side.
2.  **Bandwidth Cap:** Network packets per client should not exceed 10KB/s on average for mobile compatibility.
3.  **Interpolation:** Render remote entities in the past (Interpolation Buffer) to smooth out network jitter.

## Article 103: Performance Hygiene
1.  **Zero-Allocation Loop:** The main game loop (`Update()`) must satisfy a "Zero Garbage Collection" policy. Pre-allocate object pools for everything (bullets, effects, enemies).
2.  **Asset Optimization:** Texture Atlases and LODs (Level of Detail) are mandatory for all 3D assets.
