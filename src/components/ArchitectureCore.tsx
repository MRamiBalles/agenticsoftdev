import { motion } from "framer-motion";

const ArchitectureCore = () => {
  const nodes = [
    { label: "Estrategia", x: 50, y: 10, color: "primary" },
    { label: "Arquitectura", x: 85, y: 40, color: "primary" },
    { label: "Construcción", x: 70, y: 80, color: "primary" },
    { label: "Calidad", x: 30, y: 80, color: "accent" },
    { label: "Gobernanza", x: 15, y: 40, color: "accent" },
  ];

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs tracking-widest text-primary mb-3 block">
            // ARQUITECTURA CENTRAL
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            El Núcleo de la{" "}
            <span className="text-gradient-primary">"Fuente de la Verdad"</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Un repositorio central de especificaciones vivas que elimina el caos del{" "}
            <span className="font-mono text-primary">"vibe coding"</span> mediante Spec-Driven Development.
          </p>
        </motion.div>

        {/* Architecture diagram */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative max-w-lg mx-auto aspect-square"
        >
          {/* Connection lines (SVG) */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            {/* Lines from center to each node */}
            {nodes.map((node, i) => (
              <motion.line
                key={i}
                x1="50"
                y1="50"
                x2={node.x}
                y2={node.y}
                stroke={node.color === "accent" ? "hsl(38 92% 55% / 0.3)" : "hsl(185 85% 45% / 0.3)"}
                strokeWidth="0.3"
                strokeDasharray="2 2"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
              />
            ))}
            {/* Pentagon outline */}
            <motion.polygon
              points={nodes.map(n => `${n.x},${n.y}`).join(" ")}
              fill="none"
              stroke="hsl(185 85% 45% / 0.1)"
              strokeWidth="0.3"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.8 }}
            />
          </svg>

          {/* Center nucleus */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 md:w-36 md:h-36 rounded-full glass border-primary/30 flex flex-col items-center justify-center animate-node-pulse z-10"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
          >
            <span className="font-mono text-xs text-primary tracking-wider">SPEC.MD</span>
            <span className="text-[10px] text-muted-foreground mt-1">GitHub Spec Kit</span>
          </motion.div>

          {/* Orbiting nodes */}
          {nodes.map((node, i) => (
            <motion.div
              key={i}
              className="absolute z-20"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.12, type: "spring" }}
            >
              <div
                className={`px-3 py-2 rounded-lg glass text-xs font-mono tracking-wider whitespace-nowrap ${
                  node.color === "accent"
                    ? "border-accent/30 text-accent"
                    : "border-primary/30 text-primary"
                }`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                  node.color === "accent" ? "bg-accent" : "bg-primary"
                } animate-pulse-glow`} />
                {node.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Flow description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto"
        >
          {[
            { step: "/specify", desc: "Define el qué y el por qué", file: "spec.md" },
            { step: "/plan", desc: "Arquitectura y desglose técnico", file: "plan.md" },
            { step: "/tasks", desc: "Ejecución y verificación", file: "tasks.md" },
          ].map((item, i) => (
            <div key={i} className="glass rounded-lg p-4 text-center">
              <code className="text-primary font-mono text-sm font-semibold">{item.step}</code>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              <span className="inline-block mt-2 px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                {item.file}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ArchitectureCore;
