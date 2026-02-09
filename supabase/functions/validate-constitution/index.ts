import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RULES = 200;
const MAX_RULE_TEXT_LENGTH = 5000;

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
    const { rules } = body;

    if (!Array.isArray(rules)) throw new Error("rules must be an array");
    if (rules.length === 0) throw new Error("rules array is empty");
    if (rules.length > MAX_RULES) throw new Error(`Too many rules (max ${MAX_RULES})`);

    for (const r of rules) {
      if (!r || typeof r !== "object") throw new Error("Invalid rule format");
      if (typeof r.code !== "string" || typeof r.name !== "string") {
        throw new Error("Each rule must have code and name strings");
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const rulesText = rules
      .slice(0, MAX_RULES)
      .map(
        (r: any) =>
          `[${String(r.code).slice(0, 50)}] ${String(r.name).slice(0, 200)} (Severidad: ${String(r.severity ?? "").slice(0, 20)}, Bloqueada: ${r.is_locked}, Categoría: ${String(r.category ?? "").slice(0, 100)})\n  → ${String(r.description ?? "").slice(0, MAX_RULE_TEXT_LENGTH)}`
      )
      .join("\n\n");

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
            {
              role: "system",
              content: `Eres un Auditor de Gobernanza ISO 42001 especializado en Spec-Driven Development.
Tu tarea es analizar la constitución del proyecto (conjunto de reglas) y:
1. Evaluar si hay brechas de cobertura (¿falta algún control crítico?)
2. Detectar contradicciones entre reglas
3. Verificar alineación con ISO 42001 (transparencia, trazabilidad, responsabilidad humana)
4. Evaluar el balance entre reglas críticas bloqueadas vs desbloqueadas
5. Sugerir mejoras concretas

Responde en español, de forma concisa y estructurada.`,
            },
            {
              role: "user",
              content: `Analiza la siguiente constitución del proyecto:\n\n${rulesText}`,
            },
          ],
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
          JSON.stringify({ error: "Créditos insuficientes. Añade fondos en Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Sin análisis disponible";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-constitution error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
