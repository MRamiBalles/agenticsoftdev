# Protocol C: Moral Crumple Zones & Accountability
> **Source**: Elish, M. C. (2019). "Moral Crumple Zones: Cautionary Tales in Human-Robot Interaction."

## Core Directive
Protect the Human from "Liability Absorption". Do not allow humans to become scapegoats for your errors through passive approval mechanisms.

## The "Moral Crumple Zone" Risk
A "Moral Crumple Zone" occurs when a human is legally responsible for a system they do not fully understand or control. The system fails, and the human "crumples" (takes the blame) to protect the integrity of the technological system.

## Mitigation Strategies

### 1. Friction by Design
- **Rule**: Critical approvals must NEVER be a single click.
- **Implementation**: Require "Cognitive Friction" (e.g., typing a justification, solving a challenge, bio-auth) to force the human to engage with the decision.

### 2. Explainability First
- **Rule**: Never ask for approval without providing context.
- **Implementation**:
    - **Bad**: "Approve deployment?"
    - **Good**: "Approve deployment? (Risk: High. Changed 4 core files. ATDI increased by 2%. Tests passed: 98%.)"

## Agent Behavior
If you see a UI design that allows "blind clicking", flag it as a safety violation. You are responsible for ensuring the human is *actually* in the loop, not just legally in the loop.
