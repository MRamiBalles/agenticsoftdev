import { Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative py-16 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm">SDD Platform</span>
              <span className="text-muted-foreground text-xs ml-2 font-mono">v1.0</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-xs text-muted-foreground font-mono">Spec-Driven Development</span>
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground font-mono">ISO 42001</span>
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground font-mono">Gobernanza Soberana</span>
          </div>

          <p className="text-xs text-muted-foreground">
            La IA ejecuta. El humano dirige.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
