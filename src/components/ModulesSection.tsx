import {
  TrendingUp,
  Layers,
  Code2,
  ShieldCheck,
  Scale,
} from "lucide-react";
import ModuleCard from "./ModuleCard";
import { motion } from "framer-motion";

const modulesData = [
  {
    number: 1,
    title: "Estrategia y Mercado",
    agentName: "Product Manager Agent",
    role: "Analista de Mercado y Producto",
    objective:
      "Validar la viabilidad antes de escribir una línea de código. Análisis de competidores y tendencias en tiempo real.",
    designTools: ["Motor de Insights", "Generador de Personas"],
    verificationTool: {
      name: "Validador de Valor",
      description:
        "Sub-agente Crítico que evalúa la propuesta contra datos históricos de mercado y KPIs de negocio.",
    },
    output: "/specify → spec.md",
    icon: TrendingUp,
    accentColor: "primary" as const,
  },
  {
    number: 2,
    title: "Arquitectura y Planificación",
    agentName: "Architect Agent",
    role: "Arquitecto de Software Senior",
    objective:
      "Convertir requisitos en un plan técnico libre de Deuda Técnica Arquitectónica (ATD).",
    designTools: ["Constitution.md", "Planificador SDD"],
    verificationTool: {
      name: "Simulador de ATD",
      description:
        "Predice el Índice de Deuda Técnica (ATDI) usando ML. Rechaza planes con dependencias cíclicas.",
    },
    output: "plan.md + tasks.md",
    icon: Layers,
    accentColor: "primary" as const,
  },
  {
    number: 3,
    title: "Construcción e Implementación",
    agentName: "Coding Swarm",
    role: "Enjambre de Desarrolladores (FE, BE, DB)",
    objective:
      "Ejecución determinista basada en especificaciones con acceso a contexto dinámico vía MCP.",
    designTools: ["Agentes Scaffold", "Contexto MCP"],
    verificationTool: {
      name: "Verificador de Especificación",
      description:
        "Comprueba en paralelo que cada bloque de código cumple spec.md. Revierte código desviado.",
    },
    output: "Código verificado",
    icon: Code2,
    accentColor: "primary" as const,
  },
  {
    number: 4,
    title: "Calidad y Seguridad",
    agentName: "Guardian Agent",
    role: "QA Engineer y Auditor de Seguridad",
    objective:
      "Aseguramiento de calidad predictivo y explicable con cálculo de ATDI en tiempo real.",
    designTools: ["Generador Tests Spec-First"],
    verificationTool: {
      name: "ATDI + SHAP",
      description:
        "Calcula ATDI = Σ(Severidad × LOC) por PR. Usa valores SHAP para explicar rechazos.",
    },
    output: "PR aprobado/rechazado",
    icon: ShieldCheck,
    accentColor: "accent" as const,
  },
  {
    number: 5,
    title: "Despliegue y Gobernanza",
    agentName: "Governance Agent",
    role: "Compliance Officer / SRE",
    objective:
      "Cumplimiento normativo ISO 42001 y responsabilidad legal con trazabilidad completa.",
    designTools: ["Evidencia ISO 42001"],
    verificationTool: {
      name: "Matriz RACI Dinámica",
      description:
        "Bloquea tareas críticas sin aprobación humana con rol 'Accountable'. Zero despliegues sin humano.",
    },
    output: "Despliegue autorizado",
    icon: Scale,
    accentColor: "accent" as const,
  },
];

const ModulesSection = () => {
  return (
    <section className="relative py-24 md:py-32">
      {/* Subtle background accent */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, hsl(38 92% 55% / 0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, hsl(185 85% 45% / 0.04) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs tracking-widest text-primary mb-3 block">
            // 5 MÓDULOS EXPERTOS
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Agentes{" "}
            <span className="text-gradient-primary">Especializados</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Cada módulo con su propio toolkit de diseño y verificación, orquestados
            por el núcleo de especificaciones.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modulesData.map((mod, i) => (
            <ModuleCard key={mod.number} {...mod} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModulesSection;
