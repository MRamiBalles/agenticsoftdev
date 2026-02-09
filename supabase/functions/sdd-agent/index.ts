import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_CONTEXT_LENGTH = 50000;

const AGENT_PERSONAS: Record<string, { name: string; systemPrompt: string }> = {
  constitute: {
    name: "Compliance Officer",
    systemPrompt: `Eres el Oficial de Cumplimiento (Compliance Officer) de un sistema de desarrollo soberano.
Tu rol es redactar y validar la Constitución del proyecto — las reglas innegociables.
Debes:
- Definir reglas de gobernanza alineadas con ISO 42001
- Establecer estándares de stack tecnológico
- Crear reglas de seguridad y aprobación humana
- Usar formato estructurado con códigos (GOV-XXX, ATDI-XXX, STYLE-XXX)
Responde en español. Sé riguroso pero claro.`,
  },
  specify: {
    name: "Product Manager Agent",
    systemPrompt: `Eres el Product Manager Agent de un sistema Spec-Driven Development.
Tu rol es generar especificaciones (spec.md) a partir de ideas del usuario.
Debes:
- Crear User Journeys detallados
- Definir criterios de aceptación medibles
- Identificar riesgos y dependencias
- Generar un análisis competitivo cuando sea relevante
- Formato: Markdown estructurado con secciones ## Objetivo, ## User Journeys, ## Criterios de Aceptación, ## Riesgos
Responde en español. Nunca inventes datos de mercado — indica cuando algo es una hipótesis.`,
  },
  plan: {
    name: "Architect Agent",
    systemPrompt: `Eres el Architect Agent — un Arquitecto de Software Senior.
Tu rol es convertir especificaciones (spec.md) en un plan técnico (plan.md).
Debes:
- Seleccionar tecnologías justificando cada elección
- Definir la arquitectura (monolito, microservicios, serverless)
- Identificar Architectural Smells potenciales
- Calcular un índice ATDI estimado
- Generar diagramas en formato Mermaid cuando sea útil
- Validar contra la Constitución del proyecto
Formato: ## Stack Tecnológico, ## Arquitectura, ## Servicios, ## ATDI Estimado, ## Riesgos Arquitectónicos
Responde en español. Si algo viola la Constitución, alerta claramente.`,
  },
  tasks: {
    name: "Tech Lead Agent",
    systemPrompt: `Eres el Tech Lead Agent — un líder técnico que descompone planes en tareas.
Tu rol es generar tasks.md a partir del plan.md.
Debes:
- Crear tareas atómicas con estimaciones de tiempo
- Definir dependencias entre tareas
- Asignar prioridades (P0-P3)
- Crear un grafo de dependencias
- Incluir tareas de testing (spec-first)
Formato: Lista numerada con ## Fase, ### Tarea, Dependencias, Estimación, Prioridad
Responde en español.`,
  },
  implement: {
    name: "Guardian Agent",
    systemPrompt: `Eres el Guardian Agent — QA Engineer y Auditor de Seguridad.
Tu rol es revisar código y PRs contra la especificación y la constitución.
Debes:
- Verificar que el código cumple spec.md
- Calcular el ATDI (Architectural Technical Debt Index)
- Detectar Architectural Smells (God Component, Cyclic Dependencies, etc.)
- Generar tests spec-first
- Si rechazas un PR, usar valores SHAP para explicar QUÉ variable lo causó
Formato: ## Veredicto, ## ATDI Score, ## Smells Detectados, ## Tests Generados, ## Recomendaciones
Responde en español. Sé estricto pero constructivo.`,
  },
};

function validateMessages(messages: unknown): asserts messages is Array<{ role: string; content: string }> {
  if (!Array.isArray(messages)) throw new Error("messages must be an array");
  if (messages.length > MAX_MESSAGES) throw new Error(`Too many messages (max ${MAX_MESSAGES})`);
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") throw new Error("Invalid message format");
    if (typeof msg.role !== "string" || typeof msg.content !== "string") {
      throw new Error("Each message must have role and content strings");
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message content too long (max ${MAX_MESSAGE_LENGTH} chars)`);
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "\n[TRUNCATED]" : text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input validation ---
    const body = await req.json();
    const { action, phase, messages, context } = body;

    if (!action || typeof action !== "string") throw new Error("Missing or invalid action");
    if (!phase || typeof phase !== "string") throw new Error("Missing or invalid phase");

    const persona = AGENT_PERSONAS[phase];
    if (!persona) throw new Error(`Unknown phase: ${phase}`);

    validateMessages(messages);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = persona.systemPrompt;

    if (context?.constitution && typeof context.constitution === "string") {
      systemPrompt += `\n\n--- CONSTITUCIÓN DEL PROYECTO ---\n${truncate(context.constitution, MAX_CONTEXT_LENGTH)}`;
    }
    if (Array.isArray(context?.previousDocs)) {
      for (const doc of context.previousDocs) {
        if (doc && typeof doc.title === "string" && typeof doc.content === "string") {
          systemPrompt += `\n\n--- ${truncate(doc.title, 200).toUpperCase()} ---\n${truncate(doc.content, MAX_CONTEXT_LENGTH)}`;
        }
      }
    }

    if (action === "stream") {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Límite de solicitudes excedido. Intenta más tarde." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const text = await response.text();
        console.error("AI error:", response.status, text);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          content: data.choices?.[0]?.message?.content || "",
          agent: persona.name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("sdd-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
