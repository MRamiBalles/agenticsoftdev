# Backlog de Operaciones: Galactic Royale (Refined)

> [!NOTE]
> Tasks formatted for high-autonomy agents using **INVEST** criteria.
> Acceptance Criteria rewritten in **Gherkin** for immediate test generation.

## Epic: Core Gameplay Loop (Newtonian Flight)

### Story 1: Authoritative Thrust Application
**As a** Pilot,
**I want** to apply thrust vector changes,
**So that** I can maneuver my ship in zero-g.

- [ ] **Task 1.1: Server Input Validation**
    - **Description:** Implement `ValidateThrust()` in `AuthoritativeMovementSystem.cs`.
    - **Gherkin:**
      ```gherkin
      Given a ship with max thrust 50.0
      When client requests thrust vector (100.0, 0, 0)
      Then server should clamp vector to (50.0, 0, 0)
      And log "Thrust Violation" warning
      ```

- [ ] **Task 1.2: Client Prediction Interpolation**
    - **Description:** Implement `SmoothCorrection()` in `ClientPredictionSystem.cs`.
    - **Gherkin:**
      ```gherkin
      Given client visual position at (10, 0, 0)
      And server authoritative snapshot at (12, 0, 0)
      When reconciliation triggers
      Then ship should interpolate to (12, 0, 0) over 0.1s
      And should not teleport instantly (snap)
      ```

## Epic: Anti-Cheat & Telemetry

### Story 2: Behavioral Analysis Hook
**As a** Governance Agent,
**I want** to track input patterns,
**So that** I can identify bots using macros.

- [ ] **Task 2.1: Input Sequence Logger**
    - **Description:** Create `InputTelemetry.cs` to store last 1000 ticks of input in a ring buffer.
    - **Gherkin:**
      ```gherkin
      Given a player sending inputs
      When match ends
      Then server should serialize input history to JSON
      And calculate Levenshtein distance between sequences
      ```

### Story 3: Kill-Cam Data Recorder
**As a** Victim,
**I want** to see how I died,
**So that** I trust the game's fairness.

- [ ] **Task 3.1: State History Buffer**
    - **Description:** Server must keep 5 seconds of world state.
    - **Gherkin:**
      ```gherkin
      Given a kill event at T=1000
      When victim requests replay
      Then server should send state snapshot from T=700 to T=1000
      ```
