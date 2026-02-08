import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Plus, Folder, ArrowRight, Settings } from "lucide-react";
import { toast } from "sonner";
import { SddProject, PHASE_CONFIG } from "@/types/sdd";
import AppNavbar from "@/components/AppNavbar";

const ProjectsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<SddProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    methodology: "sdd_strict" as SddProject["methodology"],
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("sdd_projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setProjects(data as unknown as SddProject[]);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data, error } = await supabase
      .from("sdd_projects")
      .insert({ ...newProject, created_by: user.id } as any)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Proyecto creado");
    navigate(`/pipeline/${(data as any).id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-primary animate-pulse">Cargando proyectos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="pt-14">
        <section className="py-12 md:py-16">
          <div className="max-w-4xl mx-auto px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="font-mono text-xs tracking-widest text-primary block mb-2">
                  // PIPELINE SDD
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Mis Proyectos
                </h1>
              </div>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:scale-105 transition-all glow-primary"
              >
                <Plus className="w-4 h-4" />
                Nuevo Proyecto
              </button>
            </div>

            {/* Create form */}
            {showCreate && (
              <motion.form
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleCreate}
                className="glass rounded-xl p-6 mb-6 space-y-4"
              >
                <input
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Nombre del proyecto"
                  className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                  required
                />
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Descripción breve"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    {(["sdd_strict", "agile_iterative"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewProject({ ...newProject, methodology: m })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          newProject.methodology === m
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {m === "sdd_strict" ? "SDD Estricto" : "Agile/Iterativo"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:scale-105 transition-all"
                  >
                    Crear proyecto
                  </button>
                </div>
              </motion.form>
            )}

            {/* Project list */}
            <div className="space-y-3">
              {projects.map((proj, i) => {
                const phaseConfig = PHASE_CONFIG[proj.current_phase];
                return (
                  <motion.button
                    key={proj.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/pipeline/${proj.id}`)}
                    className="w-full text-left glass-hover rounded-xl p-5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Folder className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {proj.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              phaseConfig.color === "accent"
                                ? "bg-accent/10 text-accent"
                                : "bg-primary/10 text-primary"
                            }`}>
                              {phaseConfig.shortLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {proj.methodology === "sdd_strict" ? "Estricto" : "Agile"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(proj.updated_at).toLocaleDateString("es")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </motion.button>
                );
              })}

              {projects.length === 0 && !showCreate && (
                <div className="glass rounded-xl p-12 text-center">
                  <Folder className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Aún no tienes proyectos. Crea el primero para iniciar el pipeline SDD.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:scale-105 transition-all"
                  >
                    Crear mi primer proyecto
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProjectsPage;
