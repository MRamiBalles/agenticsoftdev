# Master Use Case: Implementing Governance Sensors
**Focus:** The Cyclomatic Complexity Sensor (God Component Detector)

## 1. Definition Phase (The Constitution)
Before writing code, we must define the "Law". A sensor without a constitutional basis is just an opinion.
*   **Constitutional Basis:** `constitution.md` Article III.2.
*   **Definition of "God Component":**
    *   **LOC:** > 300 lines.
    *   **Complexity:** > 15 (Cyclomatic).
    *   **Dependencies:** > 10 imports.
*   **Justification:** High complexity prevents testing and understanding. "God Components" are the primary source of technical debt (Sas & Avgeriou).

## 2. Design Phase (Tool Selection)
Why **Static Analysis (AST)** instead of Regex?
*   **Precision:** Regex cannot understand scope or context (e.g., nested loops vs. simple mapping).
*   **Tool:** `ts-morph` allows us to traverse the TypeScript AST to count nodes accurately. `typhonjs-escomplex` provides industry-standard complexity metrics (Halstead, McCabe).

## 3. Implementation Phase (The Guardian Code)
The sensor logic follows the "Guardian Agent Pattern":
1.  **Scan:** Iterate through all `.ts/.tsx` files in `src/`.
2.  **Measure:** Extract AST and calculate metrics.
3.  **Judge:** Compare metrics against Constitutional Thresholds.
4.  **Report:** Generate a JSON report explaining *exactly* why a file failed.

### The Algorithm
```typescript
Risk = (LOC - 300) * 1  // 1 point per extra line
     + (Complexity - 15) * 5 // 5 points per extra complexity unit
     + (Deps - 10) * 2 // 2 points per extra dependency
```

## 4. Calibration Phase (Threshold Tuning)
*   **Initial State:** Strict (300 LOC).
*   **Evolution:** If the team finds this too restrictive for UI components (which are naturally verbose), we can create a `constitution.override.json` to relax limits for specific folders (e.g., `src/pages/`).

## 5. How to Add a New Sensor
To add a "Security Sensor" for example:
1.  **Define Rule:** "No Hardcoded Secrets" in `constitution.md`.
2.  **Select Tool:** `gitleaks` or `semgrep`.
3.  **Implement Script:** `scripts/analyze_security.ts` to execute the tool and parse output.
4.  **Weight Risk:** Assign ATDI points (e.g., Critical = 100 points).
