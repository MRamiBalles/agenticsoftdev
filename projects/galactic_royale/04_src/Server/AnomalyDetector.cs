using System;
using System.Collections.Generic;
using Unity.Mathematics;
using GalacticRoyale.Shared;

namespace GalacticRoyale.Server
{
    // Article 104 Compliance: Behavioral Telemetry (The Sociologist)
    
    public class AnomalyDetector
    {
        // Thresholds
        private const float BOT_VARIANCE_THRESHOLD = 0.05f; // Extremely low variance = Suspect
        
        /// <summary>
        /// Calculates Levenshtein-like distance between two sequences of inputs.
        /// Actually, for continuous values, we use Dynamic Time Warping (DTW) or Variance Analysis.
        /// Levenshtein is for strings. We adapt the concept: "Edit Distance for Input Vectors".
        /// </summary>
        public float AnalyzeInputEntropy(NativeArray<PlayerInputPacket> inputHistory)
        {
            if (inputHistory.Length < 10) return 1.0f; // Not enough data, assume human (high entropy)

            // Simplistic Entropy Check:
            // Calculate variance of delta-input
            float totalDelta = 0f;
            for (int i = 1; i < inputHistory.Length; i++)
            {
                float2 prev = inputHistory[i-1].MovementAxis;
                float2 curr = inputHistory[i].MovementAxis;
                float dist = math.distance(prev, curr);
                totalDelta += dist;
            }

            float avgDelta = totalDelta / (inputHistory.Length - 1);
            
            // Hypothesis: Bots have either 0 delta (perfect hold) or perfect snaps.
            // Humans have micro-adjustments/noise.
            
            // If avgDelta is too small (perfect line) -> Bot?
            // If avgDelta is too snappy (aimlock) -> Bot?
            
            return avgDelta; 
        }

        public bool IsBotSuspect(float entropyScore)
        {
            // If entropy is suspiciously low (perfect repetition or stillness), flag it.
            return entropyScore < BOT_VARIANCE_THRESHOLD;
        }
    }
}
