using System;
using Unity.Collections;
using Unity.Networking.Transport;
using Unity.Mathematics; // Advanced Math Types

namespace GalacticRoyale.Shared
{
    // Article 103 Compliance: Zero-GC Structs for Network Messages
    
    public enum MessageType : byte
    {
        Handshake = 0,
        PlayerInput = 1,
        StateSnapshot = 2,
        ComponentDestroyed = 3
    }

    [System.Serializable]
    public struct PlayerInputPacket
    {
        public uint Tick;
        public float2 MovementAxis; // x=ThrustX, y=ThrustY (Simplified for 2D/3D hybrid)
        public float ThrustZ;       // Separate Z for 6DOF
        public float RotationYaw;
        public float RotationPitch;
        public bool IsFiring;

        // Custom Serialize for bit-packing optimization
        public void Serialize(ref DataStreamWriter writer)
        {
            writer.WriteUInt(Tick);
            writer.WriteFloat(MovementAxis.x);
            writer.WriteFloat(MovementAxis.y);
            writer.WriteFloat(ThrustZ);
            writer.WriteFloat(RotationYaw);
            writer.WriteFloat(RotationPitch);
            writer.WriteByte(IsFiring ? (byte)1 : (byte)0);
        }

        public void Deserialize(ref DataStreamReader reader)
        {
            Tick = reader.ReadUInt();
            float x = reader.ReadFloat();
            float y = reader.ReadFloat();
            MovementAxis = new float2(x, y);
            ThrustZ = reader.ReadFloat();
            RotationYaw = reader.ReadFloat();
            RotationPitch = reader.ReadFloat();
            IsFiring = reader.ReadByte() == 1;
        }
    }

    [System.Serializable]
    public struct EntityStateSnapshot
    {
        public uint EntityId;
        public float3 Position;
        public quaternion Rotation;
        public float3 Velocity;
    }
}
