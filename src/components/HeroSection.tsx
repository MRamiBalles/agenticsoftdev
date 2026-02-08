import { motion } from "framer-motion";
import { Shield, Cpu } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      
      {/* Radial gradient overlay */}
      <div 
        className="absolute inset-0" 
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, hsl(185 85% 45% / 0.08) 0%, transparent 60%)',
        }}
      />

      {/* Scan line effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-full h-px animate-scan-line opacity-20"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(185 85% 45% / 0.5), transparent)' }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full glass border-primary/20 font-mono text-xs tracking-wider"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-primary">SDD + ISO 42001</span>
          <span className="text-muted-foreground">// Spec-Driven Development</span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight"
        >
          <span className="text-foreground">Desarrollo de Software</span>
          <br />
          <span className="text-gradient-primary">Agéntico Soberano</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          Un ecosistema orquestado donde la IA ejecuta y el humano dirige.
          <br className="hidden sm:block" />
          De la escritura de código a la{" "}
          <span className="text-foreground font-medium">orquestación de especificaciones y gobernanza</span>.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/constitution" className="group relative px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm tracking-wide transition-all duration-300 hover:scale-105 glow-primary-strong">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Ver Constitución
            </span>
          </Link>
          <Link to="/auth" className="px-8 py-3.5 rounded-lg glass-hover font-semibold text-sm tracking-wide text-foreground">
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Acceso al Sistema
            </span>
          </Link>
        </motion.div>

        {/* Metrics strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
        >
          {[
            { label: "Módulos Agentes", value: "5" },
            { label: "Cobertura ISO", value: "42001" },
            { label: "Deuda Técnica", value: "ATDI" },
            { label: "Gobernanza", value: "RACI" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-bold font-mono text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
