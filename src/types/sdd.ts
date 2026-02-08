// Extended types for SDD Pipeline

export interface SddProject {
  id: string;
  name: string;
  description: string | null;
  methodology: 'sdd_strict' | 'agile_iterative';
  current_phase: SddPhase;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type SddPhase = 'constitute' | 'specify' | 'plan' | 'tasks' | 'implement';

export interface SddDocument {
  id: string;
  project_id: string;
  phase: SddPhase;
  doc_type: 'constitution' | 'spec' | 'plan' | 'tasks' | 'code_review' | 'atdi_report';
  title: string;
  content: string;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  version: number;
  generated_by: 'human' | 'agent';
  reviewed_by: string | null;
  review_comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SddAgentMessage {
  id: string;
  project_id: string;
  phase: SddPhase;
  role: 'user' | 'agent' | 'system';
  content: string;
  agent_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const PHASE_CONFIG: Record<SddPhase, {
  label: string;
  shortLabel: string;
  agent: string;
  icon: string;
  color: 'primary' | 'accent';
  docType: SddDocument['doc_type'];
  docTitle: string;
  description: string;
}> = {
  constitute: {
    label: 'Fase 0: Constitución',
    shortLabel: 'Constitución',
    agent: 'Compliance Officer',
    icon: 'Shield',
    color: 'accent',
    docType: 'constitution',
    docTitle: 'constitution.md',
    description: 'Define las reglas innegociables del proyecto',
  },
  specify: {
    label: 'Fase 1: Especificación',
    shortLabel: 'Especificación',
    agent: 'Product Manager Agent',
    icon: 'FileText',
    color: 'primary',
    docType: 'spec',
    docTitle: 'spec.md',
    description: 'Define el qué y el por qué del producto',
  },
  plan: {
    label: 'Fase 2: Planificación',
    shortLabel: 'Planificación',
    agent: 'Architect Agent',
    icon: 'Layers',
    color: 'primary',
    docType: 'plan',
    docTitle: 'plan.md',
    description: 'Arquitectura y plan técnico',
  },
  tasks: {
    label: 'Fase 3: Tareas',
    shortLabel: 'Tareas',
    agent: 'Tech Lead Agent',
    icon: 'ListChecks',
    color: 'primary',
    docType: 'tasks',
    docTitle: 'tasks.md',
    description: 'Desglose en tareas atómicas',
  },
  implement: {
    label: 'Fase 4: Implementación',
    shortLabel: 'Implementación',
    agent: 'Guardian Agent',
    icon: 'Code2',
    color: 'primary',
    docType: 'code_review',
    docTitle: 'review.md',
    description: 'Ejecución y verificación de calidad',
  },
};
