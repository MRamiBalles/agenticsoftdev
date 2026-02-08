import { motion } from "framer-motion";
import { AlertTriangle, Users, TrendingDown, Brain } from "lucide-react";

const factors = [
  {
    icon: AlertTriangle,
    title: "Zonas de Deformación Moral",
    code: "MORAL_CRUMPLE",
    description:
      "El sistema registra claramente qué parte de una decisión fue algorítmica y cuál humana. Si el agente presiona al humano para aprobar rápido, se detecta como riesgo de seguridad.",
    tag: "Ética",
    color: "destructive" as const,
  },
  {
    icon: Users,
    title: "Deuda Organizacional",
    code: "ORG_DEBT",
    description:
      "Detección de cómo la estructura del equipo (Ley de Conway) afecta el software. El Architect Agent alerta si el código se monolitiza por falta de comunicación entre equipos.",
    tag: "Conway",
    color: "accent" as const,
  },
  {
    icon: TrendingDown,
    title: "Cono de Incertidumbre Agéntico",
    code: "UNCERTAINTY_CONE",
    description:
      "Las estimaciones de los agentes se refinan progresivamente de /specify a /tasks, visualizando la reducción de incertidumbre para los gestores del proyecto.",
    tag: "Estimación",
    color: "primary" as const,
  },
  {
    icon: Brain,
    title: "Marco MAD-BAD-SAD",
    code: "MAD_BAD_SAD",
    description:
      "Check automático que evalúa Moralidad (MAD), Sesgos (BAD) y el impacto Social (SAD) de la automatización sobre el bienestar del equipo humano.",
    tag: "Gobernanza",
    color: "accent" as const,
  },
];

const colorMap = {
  destructive: {
    border: "border-destructive/30",
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
  },
  accent: {
    border: "border-accent/30",
    bg: "bg-accent/10",
    text: "text-accent",
    dot: "bg-accent",
  },
  primary: {
    border: "border-primary/30",
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
  },
};

const CriticalFactors = () => {
  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs tracking-widest text-accent mb-3 block">
            // FACTORES CRÍTICOS
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Más allá del{" "}
            <span className="text-gradient-accent">Código</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Brechas identificadas en la literatura y riesgos de la IA autónoma que el sistema debe abordar.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {factors.map((factor, i) => {
            const colors = colorMap[factor.color];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`glass-hover rounded-xl p-6 md:p-7 ${colors.border}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border}`}>
                    <factor.icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground">{factor.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${colors.bg} ${colors.text}`}>
                        {factor.tag}
                      </span>
                    </div>
                    <code className={`text-xs font-mono ${colors.text} opacity-60`}>{factor.code}</code>
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {factor.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CriticalFactors;
