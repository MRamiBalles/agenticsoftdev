using System;
using System.Collections.Generic;
using Unity.Collections;
using Unity.Mathematics;
using GalacticRoyale.Shared;

namespace GalacticRoyale.Server
{
    /// <summary>
    /// Kill-Cam Service: Psychological Fairness API
    /// 
    /// Compliance: Article 104 - Transparency & Fair Play
    /// 
    /// Provides replay data to players after death to prove fairness.
    /// This reduces "hack accusations" by showing the actual server-side truth.
    /// </summary>
    public class KillCamService
    {
        // Ring buffer of world snapshots (per-player or global)
        private Dictionary<uint, NativeArray<EntityStateSnapshot>> _playerHistories;
        private const int HISTORY_LENGTH = 300; // 5 seconds @ 60Hz
        
        private Dictionary<uint, int> _headIndices;
        
        public KillCamService()
        {
            _playerHistories = new Dictionary<uint, NativeArray<EntityStateSnapshot>>();
            _headIndices = new Dictionary<uint, int>();
        }

        /// <summary>
        /// Called every server tick to record player state.
        /// </summary>
        public void RecordState(uint playerId, EntityStateSnapshot state)
        {
            // Initialize buffer if new player
            if (!_playerHistories.ContainsKey(playerId))
            {
                _playerHistories[playerId] = new NativeArray<EntityStateSnapshot>(
                    HISTORY_LENGTH, Allocator.Persistent
                );
                _headIndices[playerId] = 0;
            }
            
            int head = _headIndices[playerId];
            _playerHistories[playerId][head % HISTORY_LENGTH] = state;
            _headIndices[playerId] = head + 1;
        }

        /// <summary>
        /// Generates a Kill-Cam replay package for a dead player.
        /// Contains the last N frames of both killer and victim.
        /// </summary>
        public KillCamPackage GenerateReplay(uint killerId, uint victimId, int framesBefore = 180)
        {
            var package = new KillCamPackage
            {
                KillerId = killerId,
                VictimId = victimId,
                KillerHistory = ExtractHistory(killerId, framesBefore),
                VictimHistory = ExtractHistory(victimId, framesBefore),
                Timestamp = DateTime.UtcNow
            };
            
            return package;
        }

        private EntityStateSnapshot[] ExtractHistory(uint playerId, int frames)
        {
            if (!_playerHistories.ContainsKey(playerId))
            {
                return new EntityStateSnapshot[0];
            }
            
            var history = _playerHistories[playerId];
            int head = _headIndices[playerId];
            int count = math.min(frames, math.min(head, HISTORY_LENGTH));
            
            var result = new EntityStateSnapshot[count];
            for (int i = 0; i < count; i++)
            {
                int idx = (head - count + i) % HISTORY_LENGTH;
                if (idx < 0) idx += HISTORY_LENGTH;
                result[i] = history[idx];
            }
            
            return result;
        }

        /// <summary>
        /// Cleanup when player disconnects.
        /// </summary>
        public void RemovePlayer(uint playerId)
        {
            if (_playerHistories.ContainsKey(playerId))
            {
                _playerHistories[playerId].Dispose();
                _playerHistories.Remove(playerId);
                _headIndices.Remove(playerId);
            }
        }

        public void Dispose()
        {
            foreach (var kvp in _playerHistories)
            {
                if (kvp.Value.IsCreated)
                    kvp.Value.Dispose();
            }
            _playerHistories.Clear();
        }
    }

    /// <summary>
    /// Serializable package sent to client for replay.
    /// </summary>
    [Serializable]
    public struct KillCamPackage
    {
        public uint KillerId;
        public uint VictimId;
        public EntityStateSnapshot[] KillerHistory;
        public EntityStateSnapshot[] VictimHistory;
        public DateTime Timestamp;
    }
}
