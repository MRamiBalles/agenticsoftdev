-- Migration: Create RACI Governance Tables
-- Description: Sets up task_assignments and governance_logs with strict accountability rules.

-- 1. Create Enum for Task Status
CREATE TYPE task_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. Create Task Assignments Table ( The "RACI Matrix" )
CREATE TABLE public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    responsible_agent TEXT NOT NULL, -- The AI Agent (Responsible)
    accountable_user_id UUID NOT NULL REFERENCES auth.users(id), -- The Human (Accountable). NOT NULL = Iron Rule #1
    status task_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Governance Audit Logs Table ( Immutable Audit Trail )
CREATE TABLE public.governance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.task_assignments(id),
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL CHECK (action IN ('APPROVED', 'REJECTED')),
    reason TEXT NOT NULL, -- Justification is mandatory
    signed_hash TEXT NOT NULL, -- Simulated crypto-signature
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Tasks: Everyone can read, only authenticated users can insert (Agents act through a service role or API)
CREATE POLICY "Enable read access for all users" ON public.task_assignments FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.task_assignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for owners" ON public.task_assignments FOR UPDATE USING (auth.uid() = accountable_user_id);

-- Logs: Everyone can read, only authenticated users can insert. NO UPDATES/DELETES allowed (Immutable)
CREATE POLICY "Enable read access for all users" ON public.governance_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.governance_logs FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- 6. Iron Rule Trigger: Prevent "Agent" from being Accountable
-- (Implemented via Schema: accountable_user_id mandates a valid Auth User ID)
-- We add a trigger to ensure the status only changes to 'approved' if a log exists? 
-- For now, we enforce that tasks cannot be saved without accountable_user_id (done via NOT NULL).

-- 7. Trigger to update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_task_assignments_updated_at
    BEFORE UPDATE ON public.task_assignments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
