using System;
using System.Collections.Generic;
using Unity.Mathematics;
using GalacticRoyale.Shared;

namespace GalacticRoyale.Client
{
    // Article 100 & 102 Compliance: Client Prediction & Reconciliation
    
    public class PredictionReconciliation
    {
        private List<PlayerInputPacket> _pendingInputs = new List<PlayerInputPacket>();
        private const float SNAP_THRESHOLD = 0.5f; // Meters
        
        // Simulates physics step (Deterministic)
        private void ApplyPhysics(ref EntityStateSnapshot state, PlayerInputPacket input)
        {
            // Simple Euler integration (Must match Server AuthoritativeMovementSystem EXACTLY)
            // In prod, this would be a shared PhysicsSystem class
            float dt = 1.0f / 60.0f;
            
            // Thrust logic
            float3 thrust = new float3(input.MovementAxis.x, input.MovementAxis.y, input.ThrustZ);
            state.Velocity += thrust * dt;
            state.Position += state.Velocity * dt;
        }

        /// <summary>
        /// Called every frame to move the player locally (Prediction).
        /// </summary>
        public EntityStateSnapshot Predict(EntityStateSnapshot currentVisualState, PlayerInputPacket input)
        {
            ApplyPhysics(ref currentVisualState, input);
            _pendingInputs.Add(input);
            return currentVisualState;
        }

        /// <summary>
        /// Handling Server Correction (Reconciliation).
        /// Replays inputs if prediction failed.
        /// </summary>
        public EntityStateSnapshot Reconcile(EntityStateSnapshot currentVisualState, EntityStateSnapshot serverState, uint lastProcessedTick)
        {
            // 1. Remove Ackerman'd inputs
            _pendingInputs.RemoveAll(i => i.Tick <= lastProcessedTick);

            // 2. Predict where we SHOULD be based on Server State + Pending Inputs
            EntityStateSnapshot predictedStateFromAuth = serverState;
            foreach (var input in _pendingInputs)
            {
                ApplyPhysics(ref predictedStateFromAuth, input);
            }

            // 3. Compare with where we ARE locally
            float dist = math.distance(currentVisualState.Position, predictedStateFromAuth.Position);

            if (dist > SNAP_THRESHOLD)
            {
                // Prediction Error too large! Hard Snap.
                Console.WriteLine($"[Reconciliation] Prediction Error: {dist}m. Snapping.");
                return predictedStateFromAuth;
            }
            else
            {
                // Error is small, keep current visual (or smooth interpolate)
                // In a real engine, we might do "Soft Correction" here
                return currentVisualState; 
            }
        }
    }
}
