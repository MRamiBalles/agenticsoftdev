import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Save, Check, X, Eye, Edit3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SddDocument, SddPhase, PHASE_CONFIG } from "@/types/sdd";
import ReactMarkdown from "react-markdown";

interface DocumentEditorProps {
  document: SddDocument | null;
  projectId: string;
  phase: SddPhase;
  generatedContent: string | null;
  onSaved: () => void;
}

const DocumentEditor = ({
  document,
  projectId,
  phase,
  generatedContent,
  onSaved,
}: DocumentEditorProps) => {
  const config = PHASE_CONFIG[phase];
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(document?.content || generatedContent || "");
  const [saving, setSaving] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  // Update content when generated
  if (generatedContent && content !== generatedContent && !editing) {
    setContent(generatedContent);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (document) {
        await supabase
          .from("sdd_documents")
          .update({ content, version: document.version + 1 } as any)
          .eq("id", document.id);
      } else {
        await supabase.from("sdd_documents").insert({
          project_id: projectId,
          phase,
          doc_type: config.docType,
          title: config.docTitle,
          content,
          generated_by: generatedContent ? "agent" : "human",
        } as any);
      }
      toast.success("Documento guardado");
      setEditing(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!document) return;
    await supabase
      .from("sdd_documents")
      .update({ status: "approved", review_comment: reviewComment || null } as any)
      .eq("id", document.id);
    toast.success("Documento aprobado ✓");
    setReviewMode(false);
    onSaved();
  };

  const handleReject = async () => {
    if (!document || !reviewComment.trim()) {
      toast.error("Escribe una justificación para el rechazo (anti-complacencia)");
      return;
    }
    await supabase
      .from("sdd_documents")
      .update({ status: "rejected", review_comment: reviewComment } as any)
      .eq("id", document.id);
    toast.success("Documento rechazado con justificación");
    setReviewMode(false);
    onSaved();
  };

  const statusColors = {
    draft: "bg-muted text-muted-foreground",
    review: "bg-accent/10 text-accent",
    approved: "bg-primary/10 text-primary",
    rejected: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-primary">{config.docTitle}</code>
          {document && (
            <>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${statusColors[document.status]}`}>
                {document.status.toUpperCase()}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">v{document.version}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {document && document.status !== "approved" && (
            <button
              onClick={() => setReviewMode(!reviewMode)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-accent hover:bg-accent/10 transition-all"
            >
              <Eye className="w-3 h-3" />
              Revisar
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Edit3 className="w-3 h-3" />
            {editing ? "Vista previa" : "Editar"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            Guardar
          </button>
        </div>
      </div>

      {/* Review bar */}
      {reviewMode && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="px-4 py-3 border-b border-accent/20 bg-accent/5"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-accent">
              Anti-Complacencia: Justifica tu decisión
            </span>
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="¿Por qué apruebas o rechazas? (obligatorio para rechazar)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:ring-2 focus:ring-accent/50 focus:outline-none resize-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:scale-105 transition-all"
            >
              <Check className="w-3 h-3" />
              Aprobar
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            >
              <X className="w-3 h-3" />
              Rechazar
            </button>
          </div>
        </motion.div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full px-4 py-3 rounded-lg bg-secondary border border-border text-sm text-foreground font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none leading-relaxed"
            placeholder={`Escribe o pega el contenido de ${config.docTitle}...`}
          />
        ) : content ? (
          <div className="prose prose-sm prose-invert max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Aún no hay contenido. Usa el chat del agente para generar {config.docTitle} o edita manualmente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;
