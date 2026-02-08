// Manual types matching our database schema

export interface RuleCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface ConstitutionRule {
  id: string;
  category_id: string;
  name: string;
  description: string;
  rationale: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  is_locked: boolean;
  version: number;
  code: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  rule_categories?: RuleCategory;
}

export interface DecisionRecord {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string | null;
  alternatives_considered: AlternativeOption[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlternativeOption {
  option: string;
  reason_rejected: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}
