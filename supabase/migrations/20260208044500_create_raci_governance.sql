-- Habilitar extensión para UUIDs si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Matriz RACI (Asignaciones)
CREATE TABLE public.task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id TEXT NOT NULL, -- ID del ticket/issue (Jira/GitHub)
    
    -- El ejecutor (Responsible) puede ser un Agente O un Humano
    responsible_agent_id TEXT, 
    responsible_user_id UUID REFERENCES auth.users(id),
    
    -- LA REGLA DE HIERRO (ISO 42001 A.3.2): 
    -- El 'Accountable' (Responsable Final) DEBE ser un usuario humano registrado en auth.users.
    -- No existe campo 'accountable_agent_id' intencionalmente.
    accountable_user_id UUID NOT NULL REFERENCES auth.users(id),
    
    role VARCHAR(4) NOT NULL CHECK (role IN ('RACI')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Validación lógica: Al menos uno debe ser responsable
    CONSTRAINT check_responsible_exists 
        CHECK (responsible_agent_id IS NOT NULL OR responsible_user_id IS NOT NULL)
);

-- 2. Tabla de Auditoría Inmutable (Logs Forenses para EU AI Act Art. 19)
CREATE TABLE public.governance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- 'DEPLOY_ATTEMPT', 'OVERRIDE', 'POLICY_VIOLATION'
    actor_id TEXT NOT NULL, -- Quién intentó la acción (Agente o Humano)
    decision_outcome VARCHAR(10) NOT NULL, -- 'APPROVED', 'BLOCKED'
    
    -- Hash criptográfico del estado del código (SHA-256)
    resource_hash VARCHAR(64) NOT NULL,
    
    -- Justificación obligatoria para evitar "clics ciegos" (Moral Crumple Zone)
    justification TEXT,
    
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger de Seguridad: Bloquear si un Agente intenta ser Accountable
-- (Aunque el esquema ya lo impide por tipo de dato, esto agrega una capa de lógica de negocio)
CREATE OR REPLACE FUNCTION enforce_human_accountability()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.accountable_user_id IS NULL THEN
        RAISE EXCEPTION 'VIOLACIÓN DE GOBERNANZA: Un Agente de IA no puede ser Accountable (Responsable Final). Se requiere un humano.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_accountability
BEFORE INSERT OR UPDATE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_human_accountability();
