import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Plus,
  Lock,
  Unlock,
  Trash2,
  Save,
  BookOpen,
  FileText,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import type { ConstitutionRule, RuleCategory, DecisionRecord, ActivityLogEntry } from "@/types/database";
import AppNavbar from "@/components/AppNavbar";

type AdminTab = "rules" | "decisions" | "activity";

const AdminPage = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("rules");
  const [categories, setCategories] = useState<RuleCategory[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // New rule form
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    rationale: "",
    severity: "high" as ConstitutionRule["severity"],
    code: "",
    category_id: "",
    is_locked: false,
  });

  // New ADR form
  const [showNewAdr, setShowNewAdr] = useState(false);
  const [newAdr, setNewAdr] = useState({
    title: "",
    context: "",
    decision: "",
    consequences: "",
    status: "proposed" as DecisionRecord["status"],
  });

  // AI validation
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/auth");
      return;
    }
    if (user && isAdmin) fetchAll();
  }, [user, isAdmin, isLoading, navigate]);

  const fetchAll = async () => {
    const [catRes, rulesRes, decRes, logRes] = await Promise.all([
      supabase.from("rule_categories").select("*").order("sort_order"),
      supabase.from("constitution_rules").select("*, rule_categories(*)").order("code"),
      supabase.from("decision_records").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (catRes.data) setCategories(catRes.data as unknown as RuleCategory[]);
    if (rulesRes.data) setRules(rulesRes.data as unknown as ConstitutionRule[]);
    if (decRes.data) setDecisions(decRes.data as unknown as DecisionRecord[]);
    if (logRes.data) setActivityLog(logRes.data as unknown as ActivityLogEntry[]);
    setLoading(false);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("constitution_rules").insert({
      ...newRule,
      created_by: user?.id,
    });
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Regla creada");
      setShowNewRule(false);
      setNewRule({ name: "", description: "", rationale: "", severity: "high", code: "", category_id: "", is_locked: false });
      fetchAll();
    }
  };

  const handleToggleLock = async (rule: ConstitutionRule) => {
    const { error } = await supabase
      .from("constitution_rules")
      .update({ is_locked: !rule.is_locked })
      .eq("id", rule.id);
    if (error) toast.error(error.message);
    else {
      toast.success(rule.is_locked ? "Regla desbloqueada" : "Regla bloqueada");
      fetchAll();
    }
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from("constitution_rules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Regla eliminada");
      fetchAll();
    }
  };

  const handleCreateAdr = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("decision_records").insert({
      ...newAdr,
      alternatives_considered: [],
      created_by: user?.id,
    });
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("ADR creado");
      setShowNewAdr(false);
      setNewAdr({ title: "", context: "", decision: "", consequences: "", status: "proposed" });
      fetchAll();
    }
  };

  const handleAIValidation = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-constitution", {
        body: {
          rules: rules.map((r) => ({
            code: r.code,
            name: r.name,
            description: r.description,
            severity: r.severity,
            is_locked: r.is_locked,
            category: r.rule_categories?.name,
          })),
        },
      });
      if (error) throw error;
      setValidationResult(data?.analysis || "Sin resultado");
    } catch (err: any) {
      toast.error("Error en validación IA: " + (err.message || "Error desconocido"));
    } finally {
      setValidating(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-primary animate-pulse">Verificando acceso...</div>
      </div>
    );
  }

  const tabs = [
    { key: "rules" as AdminTab, label: "Reglas", icon: BookOpen, count: rules.length },
    { key: "decisions" as AdminTab, label: "ADR", icon: FileText, count: decisions.length },
    { key: "activity" as AdminTab, label: "Actividad", icon: Activity, count: activityLog.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="pt-14">
        {/* Header */}
        <section className="py-8 border-b border-border">
          <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold">Panel de Administración</h1>
              </div>
              <p className="text-sm text-muted-foreground font-mono">// rol: ADMIN</p>
            </div>
            <button
              onClick={handleAIValidation}
              disabled={validating}
              className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:scale-105 transition-all glow-accent disabled:opacity-50"
            >
              {validating ? "Validando..." : "🤖 Validar con IA"}
            </button>
          </div>
        </section>

        {/* AI Validation Result */}
        {validationResult && (
          <div className="max-w-5xl mx-auto px-6 mt-4">
            <div className="glass rounded-lg p-5 border-accent/20">
              <div className="font-mono text-xs text-accent mb-2">ANÁLISIS IA</div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{validationResult}</p>
              <button onClick={() => setValidationResult(null)} className="text-xs text-muted-foreground mt-3 hover:text-foreground">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6 mt-6">
          <div className="flex gap-1 mb-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  tab === t.key
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                <span className="font-mono ml-1 opacity-60">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Rules tab */}
          {tab === "rules" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-foreground">Reglas de la Constitución</h2>
                <button
                  onClick={() => setShowNewRule(!showNewRule)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20 hover:bg-primary/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Regla
                </button>
              </div>

              {showNewRule && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  onSubmit={handleCreateRule}
                  className="glass rounded-lg p-5 mb-5 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      value={newRule.code}
                      onChange={(e) => setNewRule({ ...newRule, code: e.target.value })}
                      placeholder="Código (ej: GOV-004)"
                      className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      required
                    />
                    <select
                      value={newRule.category_id}
                      onChange={(e) => setNewRule({ ...newRule, category_id: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      required
                    >
                      <option value="">Categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Nombre de la regla"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    required
                  />
                  <textarea
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Descripción"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                    required
                  />
                  <textarea
                    value={newRule.rationale}
                    onChange={(e) => setNewRule({ ...newRule, rationale: e.target.value })}
                    placeholder="Justificación (opcional)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                  />
                  <div className="flex gap-4 items-center">
                    <select
                      value={newRule.severity}
                      onChange={(e) => setNewRule({ ...newRule, severity: e.target.value as ConstitutionRule["severity"] })}
                      className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    >
                      <option value="critical">Crítico</option>
                      <option value="high">Alto</option>
                      <option value="medium">Medio</option>
                      <option value="low">Bajo</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={newRule.is_locked}
                        onChange={(e) => setNewRule({ ...newRule, is_locked: e.target.checked })}
                        className="rounded"
                      />
                      Inmutable
                    </label>
                    <div className="flex-1" />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:scale-105 transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar
                    </button>
                  </div>
                </motion.form>
              )}

              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="glass rounded-lg px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="text-xs font-mono text-primary shrink-0">{rule.code}</code>
                      <span className="text-sm text-foreground truncate">{rule.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        rule.severity === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : rule.severity === "high"
                          ? "bg-accent/10 text-accent"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {rule.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleLock(rule)}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title={rule.is_locked ? "Desbloquear" : "Bloquear"}
                      >
                        {rule.is_locked ? (
                          <Lock className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisions tab */}
          {tab === "decisions" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-foreground">Architecture Decision Records</h2>
                <button
                  onClick={() => setShowNewAdr(!showNewAdr)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20 hover:bg-primary/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo ADR
                </button>
              </div>

              {showNewAdr && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  onSubmit={handleCreateAdr}
                  className="glass rounded-lg p-5 mb-5 space-y-4"
                >
                  <input
                    value={newAdr.title}
                    onChange={(e) => setNewAdr({ ...newAdr, title: e.target.value })}
                    placeholder="Título (ej: ADR-002: Selección de base de datos)"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    required
                  />
                  <textarea
                    value={newAdr.context}
                    onChange={(e) => setNewAdr({ ...newAdr, context: e.target.value })}
                    placeholder="Contexto: ¿Cuál es el problema o necesidad?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                    required
                  />
                  <textarea
                    value={newAdr.decision}
                    onChange={(e) => setNewAdr({ ...newAdr, decision: e.target.value })}
                    placeholder="Decisión tomada"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                    required
                  />
                  <textarea
                    value={newAdr.consequences}
                    onChange={(e) => setNewAdr({ ...newAdr, consequences: e.target.value })}
                    placeholder="Consecuencias (opcional)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:scale-105 transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Crear ADR
                    </button>
                  </div>
                </motion.form>
              )}

              <div className="space-y-2">
                {decisions.map((dec) => (
                  <div key={dec.id} className="glass rounded-lg px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        dec.status === "accepted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {dec.status.toUpperCase()}
                      </span>
                      <span className="text-sm text-foreground truncate">{dec.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {new Date(dec.created_at).toLocaleDateString("es")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity tab */}
          {tab === "activity" && (
            <div>
              <h2 className="font-bold text-foreground mb-4">Log de Actividad</h2>
              <div className="space-y-2">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="glass rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        entry.action === "INSERT"
                          ? "bg-primary/10 text-primary"
                          : entry.action === "UPDATE"
                          ? "bg-accent/10 text-accent"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        {entry.action}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{entry.table_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto font-mono">
                        {new Date(entry.created_at).toLocaleString("es")}
                      </span>
                    </div>
                  </div>
                ))}
                {activityLog.length === 0 && (
                  <div className="glass rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground">Sin actividad registrada</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
