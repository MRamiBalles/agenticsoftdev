import { motion } from "framer-motion";
import { Check, ChevronRight, Lock } from "lucide-react";
import { SddPhase, PHASE_CONFIG } from "@/types/sdd";

interface PipelineVisualizerProps {
  currentPhase: SddPhase;
  completedPhases: SddPhase[];
  onPhaseClick: (phase: SddPhase) => void;
  activePhase: SddPhase;
}

const PHASES: SddPhase[] = ['constitute', 'specify', 'plan', 'tasks', 'implement'];

const PipelineVisualizer = ({
  currentPhase,
  completedPhases,
  onPhaseClick,
  activePhase,
}: PipelineVisualizerProps) => {
  const currentIdx = PHASES.indexOf(currentPhase);

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center gap-1 min-w-max px-1">
        {PHASES.map((phase, i) => {
          const config = PHASE_CONFIG[phase];
          const isCompleted = completedPhases.includes(phase);
          const isCurrent = phase === currentPhase;
          const isActive = phase === activePhase;
          const isLocked = i > currentIdx && !isCompleted;

          return (
            <div key={phase} className="flex items-center">
              <motion.button
                whileHover={!isLocked ? { scale: 1.03 } : undefined}
                whileTap={!isLocked ? { scale: 0.97 } : undefined}
                onClick={() => !isLocked && onPhaseClick(phase)}
                disabled={isLocked}
                className={`relative px-4 py-3 rounded-lg text-left transition-all min-w-[140px] ${
                  isActive
                    ? "glass border-primary/40 glow-primary"
                    : isCompleted
                    ? "glass border-primary/20"
                    : isCurrent
                    ? "glass border-accent/30"
                    : isLocked
                    ? "bg-muted/30 border border-border opacity-50 cursor-not-allowed"
                    : "glass-hover"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <span className={`w-2 h-2 rounded-full ${
                      isCurrent ? "bg-accent animate-pulse" : "bg-primary/40"
                    }`} />
                  )}
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                    FASE {i}
                  </span>
                </div>
                <div className="text-xs font-semibold text-foreground">{config.shortLabel}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{config.agent}</div>
              </motion.button>

              {i < PHASES.length - 1 && (
                <ChevronRight className={`w-4 h-4 mx-1 shrink-0 ${
                  isCompleted ? "text-primary" : "text-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineVisualizer;
