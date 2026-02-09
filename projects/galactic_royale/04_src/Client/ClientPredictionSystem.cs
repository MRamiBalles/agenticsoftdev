using System;
using System.Collections.Generic;
using GalacticRoyale.Shared;

namespace GalacticRoyale.Client
{
    // Article 102 Compliance: Latency Compensation
    
    public class ClientPredictionSystem
    {
        private List<PlayerInputPacket> _pendingInputs = new List<PlayerInputPacket>();
        private EntityStateSnapshot _confirmedServerState;
        
        // This runs every client frame
        public void PredictMovement(PlayerInputPacket input)
        {
            // 1. Simulate locally immediately (Zero latency feel)
            // Apply physics similar to server (Shared logic preferably)
            // ApplyInput(input);
            
            // 2. Store input for reconciliation
            _pendingInputs.Add(input);
        }

        public void OnServerSnapshotReceived(EntityStateSnapshot serverState, uint lastProcessedInputTick)
        {
            _confirmedServerState = serverState;

            // Article 100: Reconciliation (Snap back if error > Epsilon)
            // 1. Remove inputs already processed by server
            _pendingInputs.RemoveAll(i => i.Tick <= lastProcessedInputTick);

            // 2. Re-simulate remaining inputs on top of server state
            EntityStateSnapshot predictedState = serverState;
            foreach(var input in _pendingInputs)
            {
                // ApplyInput(ref predictedState, input);
            }

            // 3. Smoothly correct visual error (if any)
            // StartInterpolation(currentVisualPos, predictedState.Position);
        }
    }
}
