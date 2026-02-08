
import { GovernanceLog, RaciMatrixEntry } from '../types/governance';

// Mock function to simulate the cryptographic signing process
// In a real implementation, this would interact with a wallet or a secure enclave.
export async function signGovernanceAction(
    taskId: string,
    userId: string, // The Human Accountable ID
    action: 'APPROVED' | 'BLOCKED',
    justification: string
): Promise<string> {
    if (!justification || justification.length < 10) {
        throw new Error('ISO 42001 requires a detailed justification (min 10 chars).');
    }

    // Simulate SHA-256 signing of the payload
    const payload = `${taskId}:${userId}:${action}:${justification}:${new Date().toISOString()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `sha256:${hashHex}`;
}

export async function approveTaskDeployment(
    supabase: any,
    taskId: string,
    accountableUserId: string,
    justification: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Generate Signature
        const signature = await signGovernanceAction(taskId, accountableUserId, 'APPROVED', justification);
        console.log(`🔐 Governance Signature Generated: ${signature}`);

        // 2. Insert into Ledger (Governance Logs)
        const { error } = await supabase
            .from('governance_logs')
            .insert({
                event_type: 'DEPLOY_ATTEMPT',
                actor_id: accountableUserId,
                decision_outcome: 'APPROVED',
                resource_hash: signature, // Using the signature as the resource hash for this mock
                justification: justification
            });

        if (error) throw error;

        // 3. Update Task Status (Schema doesn't have status, but we can verify role exists)
        // In this schema, we don't have a status field on task_assignments directly in the snippet provided
        // But usually we would update a status. For now, we just log the approval.

        return { success: true };

    } catch (e: any) {
        console.error("Governance Approval Failed:", e);
        return { success: false, error: e.message };
    }
}
