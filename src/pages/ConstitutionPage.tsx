import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, Code2, Lock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { ConstitutionRule, RuleCategory } from "@/types/database";
import AppNavbar from "@/components/AppNavbar";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  ShieldCheck,
  Code2,
};

const severityConfig = {
  critical: { label: "CRÍTICO", className: "bg-destructive/10 text-destructive border-destructive/20" },
  high: { label: "ALTO", className: "bg-accent/10 text-accent border-accent/20" },
  medium: { label: "MEDIO", className: "bg-primary/10 text-primary border-primary/20" },
  low: { label: "BAJO", className: "bg-muted text-muted-foreground border-border" },
};

const ConstitutionPage = () => {
  const [categories, setCategories] = useState<RuleCategory[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [catRes, rulesRes] = await Promise.all([
        supabase.from("rule_categories").select("*").order("sort_order"),
        supabase.from("constitution_rules").select("*, rule_categories(*)").order("code"),
      ]);
      if (catRes.data) setCategories(catRes.data as unknown as RuleCategory[]);
      if (rulesRes.data) setRules(rulesRes.data as unknown as ConstitutionRule[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const getRulesByCategory = (categoryId: string) =>
    rules.filter((r) => r.category_id === categoryId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-primary animate-pulse">Cargando Constitución...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="pt-14">
        {/* Header */}
        <section className="relative py-16 md:py-20 overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 50%, hsl(38 92% 55% / 0.06) 0%, transparent 50%)",
            }}
          />
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <span className="font-mono text-xs tracking-widest text-accent mb-3 block">
              // CONSTITUTION.MD
            </span>
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              La Ley Suprema del{" "}
              <span className="text-gradient-accent">Sistema</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Reglas innegociables que los agentes deben obedecer. Definidas por humanos,
              ejecutadas por máquinas, auditadas por la norma ISO 42001.
            </p>
            <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-lg glass font-mono text-xs">
              <span className="text-muted-foreground">{rules.length} reglas activas</span>
              <span className="text-border">|</span>
              <span className="text-accent">{rules.filter((r) => r.is_locked).length} bloqueadas</span>
              <span className="text-border">|</span>
              <span className="text-destructive">{rules.filter((r) => r.severity === "critical").length} críticas</span>
            </div>
          </div>
        </section>

        {/* Rules by category */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          {categories.map((category, ci) => {
            const catRules = getRulesByCategory(category.id);
            const IconComp = iconMap[category.icon || "Shield"] || Shield;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: ci * 0.1 }}
                className="mb-10"
              >
                {/* Category header */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      category.color === "accent"
                        ? "bg-accent/10 border border-accent/20"
                        : "bg-primary/10 border border-primary/20"
                    }`}
                  >
                    <IconComp className={`w-4.5 h-4.5 ${category.color === "accent" ? "text-accent" : "text-primary"}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{category.name}</h2>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                </div>

                {/* Rules list */}
                <div className="space-y-3">
                  {catRules.map((rule) => {
                    const severity = severityConfig[rule.severity];
                    const isExpanded = expandedRule === rule.id;

                    return (
                      <div
                        key={rule.id}
                        className="glass rounded-lg overflow-hidden transition-all duration-300 hover:border-primary/20"
                      >
                        <button
                          onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <code className="text-xs font-mono text-primary shrink-0">{rule.code}</code>
                            {rule.is_locked && <Lock className="w-3.5 h-3.5 text-accent shrink-0" />}
                            <span className="text-sm font-medium text-foreground truncate">{rule.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${severity.className}`}>
                              {severity.label}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="px-5 pb-5 border-t border-border"
                          >
                            <div className="pt-4 space-y-3">
                              <div>
                                <div className="font-mono text-xs text-muted-foreground mb-1">DESCRIPCIÓN</div>
                                <p className="text-sm text-foreground">{rule.description}</p>
                              </div>
                              {rule.rationale && (
                                <div>
                                  <div className="font-mono text-xs text-muted-foreground mb-1">JUSTIFICACIÓN</div>
                                  <p className="text-sm text-muted-foreground">{rule.rationale}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-4 pt-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                  v{rule.version}
                                </span>
                                {rule.is_locked && (
                                  <span className="flex items-center gap-1 text-xs text-accent font-mono">
                                    <Lock className="w-3 h-3" />
                                    INMUTABLE
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default ConstitutionPage;
