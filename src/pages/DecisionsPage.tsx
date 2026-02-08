import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import type { DecisionRecord } from "@/types/database";
import AppNavbar from "@/components/AppNavbar";

const statusConfig = {
  proposed: { label: "Propuesto", icon: Clock, className: "text-muted-foreground bg-muted" },
  accepted: { label: "Aceptado", icon: CheckCircle, className: "text-primary bg-primary/10" },
  deprecated: { label: "Deprecado", icon: AlertTriangle, className: "text-accent bg-accent/10" },
  superseded: { label: "Superado", icon: XCircle, className: "text-destructive bg-destructive/10" },
};

const DecisionsPage = () => {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("decision_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDecisions(data as unknown as DecisionRecord[]);
      setLoading(false);
    };
    fetch();
  }, [user, navigate]);

  const selected = decisions.find((d) => d.id === selectedId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-primary animate-pulse">Cargando decisiones...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="pt-14">
        {/* Header */}
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative z-10 max-w-5xl mx-auto px-6">
            <span className="font-mono text-xs tracking-widest text-primary mb-3 block">
              // ARCHITECTURE DECISION RECORDS
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Registro de <span className="text-gradient-primary">Decisiones</span>
            </h1>
            <p className="text-muted-foreground">
              Cada decisión documentada con contexto, alternativas evaluadas y consecuencias.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-3">
              {decisions.map((dec, i) => {
                const status = statusConfig[dec.status];
                const StatusIcon = status.icon;
                const isSelected = selectedId === dec.id;

                return (
                  <motion.button
                    key={dec.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedId(dec.id)}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      isSelected ? "glass border-primary/30 glow-primary" : "glass-hover"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon className={`w-4 h-4 mt-0.5 shrink-0 ${status.className.split(" ")[0]}`} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-foreground truncate">{dec.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(dec.created_at).toLocaleDateString("es")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
              {decisions.length === 0 && (
                <div className="glass rounded-lg p-6 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay decisiones registradas</p>
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="lg:col-span-2">
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-6 md:p-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`px-2.5 py-1 rounded text-xs font-mono ${statusConfig[selected.status].className}`}>
                      {statusConfig[selected.status].label}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(selected.created_at).toLocaleString("es")}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-foreground mb-6">{selected.title}</h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-mono text-xs text-muted-foreground tracking-wider mb-2">CONTEXTO</h3>
                      <p className="text-sm text-foreground leading-relaxed">{selected.context}</p>
                    </div>

                    <div>
                      <h3 className="font-mono text-xs text-muted-foreground tracking-wider mb-2">DECISIÓN</h3>
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm text-foreground leading-relaxed">{selected.decision}</p>
                      </div>
                    </div>

                    {selected.consequences && (
                      <div>
                        <h3 className="font-mono text-xs text-muted-foreground tracking-wider mb-2">CONSECUENCIAS</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{selected.consequences}</p>
                      </div>
                    )}

                    {selected.alternatives_considered && selected.alternatives_considered.length > 0 && (
                      <div>
                        <h3 className="font-mono text-xs text-accent tracking-wider mb-3">
                          ALTERNATIVAS DESCARTADAS ({selected.alternatives_considered.length})
                        </h3>
                        <div className="space-y-3">
                          {selected.alternatives_considered.map((alt, i) => (
                            <div key={i} className="p-4 rounded-lg bg-accent/5 border border-accent/15">
                              <div className="flex items-start gap-2">
                                <XCircle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{alt.option}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{alt.reason_rejected}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="glass rounded-xl p-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Selecciona una decisión para ver su detalle completo
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DecisionsPage;
