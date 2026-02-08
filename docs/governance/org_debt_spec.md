# Organizational Debt Specification (Inverse Conway's Law)

**Version:** 1.0
**Goal:** Detect "Social Friction" where agent/human coordination costs exceed architectural value.

## 1. The Theory: Inverse Conway's Law
*   **Conway's Law:** "Organizations design systems that mirror their communication structure."
*   **Inverse:** If the system is monolithic but the team is distributed (or swarming with many agents), we accumulate **Organizational Debt**.
*   **Sovereign Metric:** We measure **Coordination Cost**.

## 2. The Metric: Social Complexity (SC)
For each file/module, we calculate:
$$ SC = |Authors_{Unique}| + (Commits_{Frequency} * 0.1) $$

*   **Logic:** A file touched by 5 different Agents/Humans is a "Coordination Hotspot". It is likely widely coupled and fragile.
*   **Thresholds:**
    *   🟢 **SC < 3:** Healthy ownership (Single Agent/Human + Reviewer).
    *   🟡 **SC 3-5:** Friction (Requires synchronization).
    *   🔴 **SC > 5:** **The "Orgy" Pattern.** Too many cooks. High risk of "Moral Crumple Zone" failure.

## 3. Implementation: `analyze_org_debt.ts`
1.  **Data Source:** `git log --pretty=format:"%H|%an|%cd" --name-only`
2.  **Parsing:** Map `File -> Set<AuthorName>`.
3.  **Agent Awareness:** Distinguish between "Human" authors and "Agent" authors (e.g., `ArchitectAgent`, `Claude`, `GPT-4`).
4.  **Reporting:** Generate `src/data/org_debt_report.json`.

## 4. UI Visualization
*   **Heatmap:** Files colored by SC.
*   **Hotspot List:** "Top 5 Files causing Organizational Debt".
*   **Recommendation:** "Refactor `X` into micro-module" or "Assign `X` to single Agent".
