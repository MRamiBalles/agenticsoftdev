# Phase 3.1: RAG Semántico — Protocolo "Mnemosyne"

**Version:** 1.0
**Date:** 2026-02-09
**Authority:** `constitution.md` Art. VII.2 (Intent of the Legislator)
**Prerequisite:** Phase 3 (Security & Isolation) — Complete

## Objective
Dotar a los agentes de Memoria Institucional a Largo Plazo mediante RAG semántico sobre pgvector, eliminando la Amnesia del Proyecto y la Deriva Arquitectónica.

## Architecture: Tiered Context Model

```
┌─────────────────────────────────────────────────────┐
│  LTM (Long-Term Memory) — pgvector                  │
│  ├─ Constitution (Articles I-VII) — ALWAYS injected  │
│  ├─ ADRs (accepted decisions) — retrieved on-demand  │
│  └─ Session Summaries (compacted learnings)           │
├─────────────────────────────────────────────────────┤
│  Working Context (Ephemeral, per-task)               │
│  ├─ Retrieved chunks (top-K relevant)                │
│  ├─ Current spec.md / plan.md                        │
│  └─ Task-specific source files (just-in-time)        │
├─────────────────────────────────────────────────────┤
│  Artifacts (Reference-only, loaded on demand)        │
│  ├─ Source code files                                │
│  ├─ Governance logs                                  │
│  └─ Build/test outputs                               │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. Supabase Migration (`supabase/migrations/..._create_knowledge_vectors.sql`)
- Enable pgvector extension
- Create `knowledge_vectors` table with metadata facets
- RLS policies: read-only for agent roles, write for architect/human

### 2. Semantic Chunker (`src/orchestrator/memory/semantic-chunker.ts`)
- Parse markdown documents into atomic chunks
- Extract structured facets: `domain`, `status`, `impact`, `constitutional_ref`
- Chunk by logical section (not fixed-size), preserving heading hierarchy
- Output: `KnowledgeChunk[]` with text + metadata

### 3. Vector Ingestion Pipeline (`src/orchestrator/memory/ingest-pipeline.ts`)
- Read constitution.md, docs/adr/*.md, docs/decisions/*.md
- Chunk via semantic chunker
- Generate embeddings (TF-IDF local or Supabase embeddings)
- Upsert into `knowledge_vectors` table
- Track ingestion state to avoid re-processing unchanged docs

### 4. Retrieval Service (`src/orchestrator/memory/retrieval-service.ts`)
- Semantic search: query → top-K relevant chunks
- Facet filtering: by domain, status, impact level
- RBAC enforcement: Builder=READ, Architect=READ+WRITE, Guardian=READ
- Memory poisoning defense: only ACCEPTED ADRs are queryable
- Context assembly: format retrieved chunks for injection into agent prompt

### 5. Planning Gate (`src/orchestrator/memory/planning-gate.ts`)
- Mandatory pre-plan consultation: extract keywords from task → query RAG
- Contradiction detection: flag if plan conflicts with retrieved precedents
- Context contract: NEEDS/PROVIDES validation between agents
- Integration with orchestrator dispatch pipeline

### 6. Context Compactor (`src/orchestrator/memory/context-compactor.ts`)
- Post-session summarization of key decisions
- Store compacted summaries as new knowledge chunks
- Prune low-signal entries from working context

## RBAC for Memory Access

| Role | Read Vectors | Write Vectors | Ingest New ADRs |
|:---|:---|:---|:---|
| **architect** | ✅ | ✅ (reviewed) | ✅ |
| **builder** | ✅ | ❌ | ❌ |
| **guardian** | ✅ | ❌ | ❌ |
| **strategist** | ✅ | ✅ | ✅ |
| **human** | ✅ | ✅ | ✅ |

## File Changes
- [NEW] `supabase/migrations/20260209_create_knowledge_vectors.sql`
- [NEW] `src/orchestrator/memory/semantic-chunker.ts`
- [NEW] `src/orchestrator/memory/ingest-pipeline.ts`
- [NEW] `src/orchestrator/memory/retrieval-service.ts`
- [NEW] `src/orchestrator/memory/planning-gate.ts`
- [NEW] `src/orchestrator/memory/context-compactor.ts`
- [MODIFY] `src/orchestrator/main.ts` (integrate planning gate)
- [MODIFY] `src/orchestrator/security-gate.ts` (add MEMORY_WRITE permission)
- [NEW] `tests/memory/retrieval-service.test.ts`
- [NEW] `tests/memory/planning-gate.test.ts`

## Security: Memory Poisoning Defense
- Only documents with `status: ACCEPTED` are indexed
- Builder/Guardian agents have READ-ONLY access to vectors
- All writes to knowledge_vectors are logged in forensic ledger
- Hash verification: ingested document hash stored to detect tampering

## Verification Strategy
- [ ] Unit tests for semantic chunker (facet extraction, section splitting)
- [ ] Unit tests for retrieval service (search, RBAC, filtering)
- [ ] Unit tests for planning gate (contradiction detection, mandatory query)
- [ ] Integration: Architect agent queries memory before generating plan
- [ ] Regression: Phase 3 security tests still pass
