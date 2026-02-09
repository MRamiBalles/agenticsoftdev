-- Migration: Phase 3.1 — Protocolo Mnemosyne
-- Description: Enable pgvector and create knowledge_vectors table for RAG semantic memory.
-- Compliance: ISO 42001 A.6.2.8, constitution.md Art. VII.2

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Vectors Table (Institutional Memory)
CREATE TABLE IF NOT EXISTS public.knowledge_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Content
    content TEXT NOT NULL,                          -- The actual text chunk
    embedding vector(384),                          -- Embedding vector (384-dim for MiniLM/local models)

    -- Source Provenance
    source_type VARCHAR(20) NOT NULL                -- 'constitution', 'adr', 'decision', 'session_summary'
        CHECK (source_type IN ('constitution', 'adr', 'decision', 'session_summary')),
    source_file TEXT NOT NULL,                      -- Relative path to source document
    source_hash VARCHAR(64) NOT NULL,               -- SHA-256 of source document (tamper detection)
    chunk_index INTEGER NOT NULL DEFAULT 0,         -- Position within source document

    -- Structured Facets (Peripheral Vision)
    domain VARCHAR(50),                             -- 'security', 'persistence', 'frontend', 'netcode', 'governance', 'architecture'
    status VARCHAR(20) DEFAULT 'active'             -- 'active', 'deprecated', 'proposed'
        CHECK (status IN ('active', 'deprecated', 'proposed')),
    impact VARCHAR(20) DEFAULT 'standard'           -- 'critical', 'high', 'standard', 'low'
        CHECK (impact IN ('critical', 'high', 'standard', 'low')),
    constitutional_ref TEXT,                        -- e.g. 'Article III.2', 'Article IV.1'
    tags TEXT[] DEFAULT '{}',                       -- Free-form tags for filtering

    -- Access Control
    write_role VARCHAR(20) NOT NULL DEFAULT 'architect'  -- Who ingested this chunk
        CHECK (write_role IN ('architect', 'strategist', 'human')),

    -- Audit
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_embedding
    ON public.knowledge_vectors
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_source_type
    ON public.knowledge_vectors (source_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_domain
    ON public.knowledge_vectors (domain);

CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_status
    ON public.knowledge_vectors (status);

CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_source_hash
    ON public.knowledge_vectors (source_hash);

-- 4. RLS Policies (Memory Poisoning Defense)
ALTER TABLE public.knowledge_vectors ENABLE ROW LEVEL SECURITY;

-- Read access: all authenticated roles can read active knowledge
CREATE POLICY "knowledge_read_active"
    ON public.knowledge_vectors
    FOR SELECT
    USING (status != 'deprecated');

-- Write access: only architect, strategist, and human roles
-- (In practice, this is enforced at the application layer via SecurityGate RBAC,
--  but we add DB-level defense-in-depth)
CREATE POLICY "knowledge_write_authorized"
    ON public.knowledge_vectors
    FOR INSERT
    WITH CHECK (write_role IN ('architect', 'strategist', 'human'));

-- Update access: same as write
CREATE POLICY "knowledge_update_authorized"
    ON public.knowledge_vectors
    FOR UPDATE
    USING (write_role IN ('architect', 'strategist', 'human'));

-- 5. Function: Semantic similarity search
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding vector(384),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_domain TEXT DEFAULT NULL,
    filter_source_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source_type VARCHAR(20),
    source_file TEXT,
    domain VARCHAR(50),
    status VARCHAR(20),
    impact VARCHAR(20),
    constitutional_ref TEXT,
    tags TEXT[],
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kv.id,
        kv.content,
        kv.source_type,
        kv.source_file,
        kv.domain,
        kv.status,
        kv.impact,
        kv.constitutional_ref,
        kv.tags,
        1 - (kv.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_vectors kv
    WHERE
        kv.status != 'deprecated'
        AND (filter_domain IS NULL OR kv.domain = filter_domain)
        AND (filter_source_type IS NULL OR kv.source_type = filter_source_type)
        AND 1 - (kv.embedding <=> query_embedding) > match_threshold
    ORDER BY kv.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Comment documentation
COMMENT ON TABLE public.knowledge_vectors IS 'Phase 3.1 Mnemosyne: Institutional memory for RAG-based agent reasoning. Stores semantic chunks from Constitution, ADRs, and session summaries.';
COMMENT ON FUNCTION match_knowledge IS 'Semantic similarity search over institutional knowledge. Used by Architect Agent for pre-plan consultation.';
