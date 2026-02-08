
import { useEffect, useState } from 'react';

// GOD COMPONENT SIMULATION
// This file is designed to trigger the Complexity Sensor (ATDI v2)
// Violations:
// 1. Complexity > 15 (Nested loops, conditions)
// 2. LOC > 300 (Simulated with comments)

export const BadComponent = () => {
    const [state, setState] = useState(0);

    // Complexity Bomb
    const complexLogic = () => {
        if (state > 0) {
            for (let i = 0; i < 10; i++) {
                if (i % 2 === 0) {
                    switch (i) {
                        case 0: console.log("Zero"); break;
                        case 2: console.log("Two"); break;
                        default:
                            if (true) {
                                while (false) {
                                    // Dead code
                                }
                            }
                    }
                } else {
                    if (state < 100 && state > 50 || state === 10) {
                        console.log("Complex Condition");
                    }
                }
            }
        }
    };

    // LOC Bomb (Simulated padding)
    // ....................................................................................................
    // ....................................................................................................
    // ....................................................................................................
    // (Imagine 300 lines of spaghetti code here)
    // ....................................................................................................
    // ....................................................................................................

    return (
        <div>
            <h1>I am a God Component</h1>
            <button onClick={complexLogic}>Click Me</button>
        </div>
    );
};
