export type RaciRole = 'RACI'; // From CHECK constraint

export interface RaciMatrixEntry {
  id: string;
  task_id: string;
  responsible_agent_id?: string | null;
  responsible_user_id?: string | null;
  accountable_user_id: string; // The Iron Rule: NOT NULL
  role: string | 'RACI';
  created_at: string;
}

export interface GovernanceLog {
  id: string;
  event_type: 'DEPLOY_ATTEMPT' | 'OVERRIDE' | 'POLICY_VIOLATION';
  actor_id: string;
  decision_outcome: 'APPROVED' | 'BLOCKED';
  resource_hash: string;
  justification: string;
  timestamp: string;
}
