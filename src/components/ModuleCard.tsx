import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface ModuleCardProps {
  number: number;
  title: string;
  agentName: string;
  role: string;
  objective: string;
  designTools: string[];
  verificationTool: { name: string; description: string };
  output: string;
  icon: LucideIcon;
  accentColor: "primary" | "accent";
  delay?: number;
}

const ModuleCard = ({
  number,
  title,
  agentName,
  role,
  objective,
  designTools,
  verificationTool,
  output,
  icon: Icon,
  accentColor,
  delay = 0,
}: ModuleCardProps) => {
  const isAccent = accentColor === "accent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className={`group relative glass-hover rounded-xl p-6 md:p-8 overflow-hidden ${
        isAccent ? "hover:border-accent/30" : ""
      }`}
    >
      {/* Glow effect on hover */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl ${
          isAccent ? "glow-accent" : "glow-primary"
        }`}
      />

      {/* Module number */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isAccent
                  ? "bg-accent/10 border border-accent/20"
                  : "bg-primary/10 border border-primary/20"
              }`}
            >
              <Icon className={`w-5 h-5 ${isAccent ? "text-accent" : "text-primary"}`} />
            </div>
            <div>
              <span className={`font-mono text-xs tracking-wider ${isAccent ? "text-accent" : "text-primary"}`}>
                MÓDULO {number}
              </span>
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
            </div>
          </div>
        </div>

        {/* Agent name tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-4 rounded-md bg-secondary text-secondary-foreground font-mono text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${isAccent ? "bg-accent" : "bg-primary"}`} />
          {agentName}
        </div>

        {/* Role & Objective */}
        <p className="text-sm text-muted-foreground mb-1">
          <span className="text-foreground font-medium">Rol:</span> {role}
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          {objective}
        </p>

        {/* Design Tools */}
        <div className="mb-4">
          <div className="font-mono text-xs text-muted-foreground mb-2 tracking-wider">HERRAMIENTAS DE DISEÑO</div>
          <div className="flex flex-wrap gap-2">
            {designTools.map((tool, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-muted text-xs text-foreground border border-border"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Verification */}
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="font-mono text-xs text-muted-foreground mb-1 tracking-wider">VERIFICACIÓN</div>
          <div className="text-sm font-medium text-foreground">{verificationTool.name}</div>
          <p className="text-xs text-muted-foreground mt-1">{verificationTool.description}</p>
        </div>

        {/* Output */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">SALIDA →</span>
          <code className={`text-xs font-mono px-2 py-0.5 rounded ${
            isAccent ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
          }`}>
            {output}
          </code>
        </div>
      </div>
    </motion.div>
  );
};

export default ModuleCard;
