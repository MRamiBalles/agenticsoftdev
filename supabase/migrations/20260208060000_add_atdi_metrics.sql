-- Migration: Add ATDI Quality Metrics
-- Description: Adds columns to store architectural technical debt index and risk reports.

ALTER TABLE public.governance_logs 
ADD COLUMN IF NOT EXISTS atdi_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_metadata JSONB DEFAULT '{}'::jsonb;

-- Comment on columns
COMMENT ON COLUMN public.governance_logs.atdi_score IS 'Architectural Technical Debt Index based on Sas & Avgeriou formula';
COMMENT ON COLUMN public.governance_logs.risk_metadata IS 'Detailed report of detected smells (cycles, god components)';
