import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Plus, ArrowRight, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SddProject, SddPhase, SddDocument, PHASE_CONFIG } from "@/types/sdd";
import AppNavbar from "@/components/AppNavbar";
import PipelineVisualizer from "@/components/pipeline/PipelineVisualizer";
import AgentChat from "@/components/pipeline/AgentChat";
import DocumentEditor from "@/components/pipeline/DocumentEditor";

const PHASES: SddPhase[] = ["constitute", "specify", "plan", "tasks", "implement"];

const PipelinePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<SddProject | null>(null);
  const [documents, setDocuments] = useState<SddDocument[]>([]);
  const [activePhase, setActivePhase] = useState<SddPhase>("constitute");
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (projectId) fetchProject();
  }, [user, projectId]);

  const fetchProject = async () => {
    const [projRes, docsRes] = await Promise.all([
      supabase.from("sdd_projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("sdd_documents").select("*").eq("project_id", projectId).order("created_at"),
    ]);
    if (projRes.data) {
      setProject(projRes.data as unknown as SddProject);
      setActivePhase((projRes.data as any).current_phase);
    }
    if (docsRes.data) setDocuments(docsRes.data as unknown as SddDocument[]);
    setLoading(false);
  };

  const completedPhases = PHASES.filter((phase) =>
    documents.some((d) => d.phase === phase && d.status === "approved")
  );

  const currentDoc = documents.find((d) => d.phase === activePhase);

  const handleAdvancePhase = async () => {
    if (!project) return;
    const currentIdx = PHASES.indexOf(project.current_phase);
    if (currentIdx >= PHASES.length - 1) return;

    // Check if current phase doc is approved
    const currentPhaseDoc = documents.find(
      (d) => d.phase === project.current_phase && d.status === "approved"
    );
    if (!currentPhaseDoc) {
      toast.error("Debes aprobar el documento de esta fase antes de avanzar");
      return;
    }

    const nextPhase = PHASES[currentIdx + 1];
    await supabase
      .from("sdd_projects")
      .update({ current_phase: nextPhase } as any)
      .eq("id", project.id);
    toast.success(`Avanzando a ${PHASE_CONFIG[nextPhase].label}`);
    setActivePhase(nextPhase);
    fetchProject();
  };

  const handleDocumentGenerated = useCallback((content: string) => {
    setGeneratedContent(content);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-primary animate-pulse">Cargando pipeline...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Proyecto no encontrado</div>
      </div>
    );
  }

  const canAdvance =
    documents.some((d) => d.phase === project.current_phase && d.status === "approved") &&
    PHASES.indexOf(project.current_phase) < PHASES.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNavbar />
      <div className="pt-14 flex-1 flex flex-col">
        {/* Project header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">{project.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {project.methodology === "sdd_strict" ? "SDD Estricto" : "Agile/Iterativo"} •{" "}
                {PHASE_CONFIG[project.current_phase].label}
              </p>
            </div>
            {canAdvance && (
              <button
                onClick={handleAdvancePhase}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:scale-105 transition-all glow-primary"
              >
                Avanzar fase
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Pipeline */}
        <div className="px-6 py-3 border-b border-border bg-muted/20">
          <div className="max-w-7xl mx-auto">
            <PipelineVisualizer
              currentPhase={project.current_phase as SddPhase}
              completedPhases={completedPhases}
              onPhaseClick={setActivePhase}
              activePhase={activePhase}
            />
          </div>
        </div>

        {/* Main content: Chat + Document side by side */}
        <div className="flex-1 flex min-h-0">
          {/* Agent Chat */}
          <div className="w-1/2 border-r border-border flex flex-col min-h-0">
            <AgentChat
              projectId={project.id}
              phase={activePhase}
              documents={documents}
              onDocumentGenerated={handleDocumentGenerated}
            />
          </div>

          {/* Document Editor */}
          <div className="w-1/2 flex flex-col min-h-0">
            <DocumentEditor
              document={currentDoc || null}
              projectId={project.id}
              phase={activePhase}
              generatedContent={generatedContent}
              onSaved={() => {
                setGeneratedContent(null);
                fetchProject();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelinePage;
