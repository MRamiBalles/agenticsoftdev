using System;
using Unity.Collections;
using Unity.Mathematics;
using UnityEngine;
using GalacticRoyale.Shared;

namespace GalacticRoyale.Client
{
    /// <summary>
    /// Captures player input history for specialized analysis (Anti-Cheat / Kill-Cam).
    /// Compliant with Article 103: Zero-GC in Hot Paths.
    /// </summary>
    public class InputTelemetry : MonoBehaviour
    {
        // Article 103: Unmanaged memory buffer to prevent GC spikes
        private NativeArray<PlayerInputPacket> _inputBuffer;
        private int _bufferHeadIndex;
        private const int BUFFER_SIZE = 4096; // ~60 seconds of history at 60Hz

        [Header("Debug")]
        public bool ShowDebugStats = false;

        void Awake()
        {
            // Allocator.Persistent means this memory lives until we explicitly Dispose it.
            // It sits outside the Garbage Collector's view.
            _inputBuffer = new NativeArray<PlayerInputPacket>(BUFFER_SIZE, Allocator.Persistent);
            _bufferHeadIndex = 0;
            
            Debug.Log("[InputTelemetry] Initialized Zero-GC Buffer.");
        }

        void Update()
        {
            CaptureInputFrame();
        }

        private void CaptureInputFrame()
        {
            // 1. Collect Data (Stack Allocation only)
            // Using Unity.Mathematics (float2) for SIMD optimization possibility
            float h = Input.GetAxisRaw("Horizontal");
            float v = Input.GetAxisRaw("Vertical");
            bool fire = Input.GetButton("Fire1");
            
            // 2. Populate Struct (Value Type - No Heap Alloc)
            PlayerInputPacket packet = new PlayerInputPacket
            {
                Tick = (uint)Time.frameCount, // Ideally sync with ServerTick
                MovementAxis = new float2(h, v), // Assuming NetworkProtocol updated to use float2
                IsFiring = fire,
                // ViewYaw/Pitch would come from Camera/Mouse delta
                RotationYaw = 0f, 
                RotationPitch = 0f 
            };

            // 3. Write to Circular Buffer
            _inputBuffer[_bufferHeadIndex % BUFFER_SIZE] = packet;
            _bufferHeadIndex++;
        }

        /// <summary>
        /// Retrieves a snapshot of the history for sending to server or replay.
        /// Warning: This creates a copy (allocates), so call sparingly (e.g. on death or match end).
        /// </summary>
        public NativeArray<PlayerInputPacket> GetHistorySnapshot(Allocator allocator)
        {
            int count = math.min(_bufferHeadIndex, BUFFER_SIZE);
            var snapshot = new NativeArray<PlayerInputPacket>(count, allocator);
            
            // TODO: Implement circular buffer unwrap copy logic if needed
            // For now, raw dump
            NativeArray<PlayerInputPacket>.Copy(_inputBuffer, snapshot, count);
            return snapshot;
        }

        void OnDestroy()
        {
            // Critical: Free unmanaged memory
            if (_inputBuffer.IsCreated)
            {
                _inputBuffer.Dispose();
                Debug.Log("[InputTelemetry] Buffer Disposed.");
            }
        }
    }
}
