# Game Design Document (GDD): Galactic Royale

## 0. Executive Summary
- **Title:** Galactic Royale (Project GR)
- **Genre:** Space Combat Battle Royale (6DOF)
- **Core Loop:** Loot ship components -> Upgrade stats -> Survive the gravity well collapse.
- **Target Platform:** PC (Steam), High-end Mobile (Later)
- **Vision:** "Kerbal Space Program meets PUBG". Real Newtonian physics, components fly off when hit.

## 1. Gameplay Mechanics (The "Verb" List)
### Core Verbs
- **Trust/Boost:** Apply force vector in 3D space (Newtonian inertia, no "drag" in space).
- **Detach:** Eject damaged components to reduce mass/profile.
- **Grapple:** Use magnetic beams to loot floating debris from destroyed enemies.

### Win/Loss Conditions
- **Win:** Be the last ship intact within the safe zone (Event Horizon).
- **Lose:** Ship Core destroyed or consumed by the Singularity (Zone).

## 2. Multiplayer Architecture Requirements
> [!IMPORTANT]
> Must adhere to Article 100-103 of Project Constitution.
- **Max Players:** 50 Ships per instance.
- **Physics Complexity:** High. RigidBody simulation for every ship component (Wing, Engine, Weapon).
- **Latency Tolerance:** Low (<100ms preferred). Fast-paced dogfights.
- **Anti-Cheat:** Critical. Aimbots and "Speed Hacks" (Infinite Thrust) must be impossible.

## 3. Progression & Meta-Game
- **Session Length:** 15-20 minutes.
- **Persistence:** Hangar (Cosmetics only), Pilot Rank (ELO based).

## 4. User Interface (HUD)
- **Velocity Vector:** Prograde/Retrograde markers (Critical for Newtonian flight).
- **Component Status:** Holographic wireframe showing damaged parts.
- **Gravity Well Warning:** Visual distortion notifying zone closure.
