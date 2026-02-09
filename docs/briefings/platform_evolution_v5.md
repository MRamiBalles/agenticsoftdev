# 🦅 Operation Platform Evolution v5.0: Pod Briefing Pack

> [!NOTE]
> Este documento contiene las directivas personalizadas para cada rol del Pod Agéntico, basadas en el análisis estratégico consolidado.

---

## 🧠 To: The Strategist (Product Manager)
**Subject:** Governance & Context Engineering

**Directivas:**
1.  **ADRs Obligatorios:** Ninguna decisión arquitectónica se implementa sin un ADR en `docs/decisions/`.
2.  **Contratos NEEDS/PROVIDES:** Formalizar qué datos necesita cada agente y qué produce.
3.  **Human-in-the-Loop 2.0:** Antes de pedir firma, generar "Resumen de Impacto" (Delta Complejidad, Nuevas Dependencias).

**Entregables:**
- [ ] `docs/decisions/adr_template.md`
- [ ] Sección NEEDS/PROVIDES en `AGENTS.md`

---

## 🏛️ To: The Architect (Systems & Netcode)
**Subject:** Infrastructure & Protocol Hardening

**Directivas:**
1.  **Agones:** Diseñar `gameserver.yaml` con strategy `Packed`.
2.  **Clock Sync:** Implementar protocolo NTP simplificado (`ClockSync.cs`).
3.  **Input Redundancy:** Modificar `NetworkProtocol.cs` para enviar últimos 3 inputs en cada paquete.
4.  **FlatBuffers:** Evaluar e implementar esquema binario para `EntityStateSnapshot`.

**Entregables:**
- [ ] `infra/agones/gameserver.yaml`
- [ ] `04_src/Shared/ClockSync.cs`
- [ ] `04_src/Shared/flatbuffers/entity_state.fbs`

---

## 🧱 To: The Builder (Gameplay & Engine)
**Subject:** Determinism & Performance

**Directivas:**
1.  **Zero-GC Estricto:** Auditar hot paths restantes. Cero `new` en `Update/FixedUpdate`.
2.  **Kill-Cam Service:** Implementar `KillCamService.cs` (serializa historial).
3.  **Determinismo:** Si se detecta desync, evaluar `SoftFloat` o `Fixed-Point`.

**Entregables:**
- [ ] `04_src/Server/KillCamService.cs`
- [ ] Reporte de auditoría de memory allocs.

---

## 🛡️ To: The Guardian (SRE & QA)
**Subject:** Security Gates & Observability

**Directivas:**
1.  **Dependency Firewall:** Implementar `scripts/security/dependency_firewall.ts` (hook pre-commit).
2.  **Sandbox:** Crear `docker/agent_sandbox/Dockerfile` (sin red, timeout 30s).
3.  **Prompt Injection:** Implementar sanitizador de inputs (regex + allowlist de comandos).
4.  **Observabilidad:** Conectar `vital_signs.json` a dashboard (Grafana o custom React).

**Entregables:**
- [ ] `scripts/security/dependency_firewall.ts`
- [ ] `docker/agent_sandbox/Dockerfile`
- [ ] Dashboard config o código.

---

## 📡 To: The Sociologist (Behavioral Analysis)
**Subject:** Golden Dataset & Anomaly Refinement

**Directivas:**
1.  **Golden Dataset:** Curar `tests/golden/golden_dataset.json` con inputs humanos verificados.
2.  **Refinar Umbral:** Calibrar `BOT_VARIANCE_THRESHOLD` usando datos reales.
3.  **GNN (Futuro):** Investigar Graph Neural Networks para mapear interacciones entre jugadores.

**Entregables:**
- [ ] `tests/golden/golden_dataset.json`
- [ ] Reporte de calibración de umbrales.

---

## 🤖 To: The Orchestrator (Meta-Agent)
**Subject:** DAG Engine & Semantic RAG

**Directivas:**
1.  **DAG Engine:** Migrar de scripts lineales a `src/orchestrator/dag_engine.ts`.
2.  **Autosanación:** Si un nodo falla, activar ruta alternativa (retry o fallback agent).
3.  **RAG Semántico:** Implementar `src/memory/semantic_rag.ts` (cliente pgvector).
4.  **Agentes Stateful:** El Arquitecto debe mantener modelo mental persistente (diagrama Mermaid actualizado).

**Entregables:**
- [ ] `src/orchestrator/dag_engine.ts`
- [ ] `src/memory/semantic_rag.ts`
- [ ] Diagrama Mermaid auto-actualizado en `docs/architecture/`.
