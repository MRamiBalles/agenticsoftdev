import HeroSection from "@/components/HeroSection";
import ArchitectureCore from "@/components/ArchitectureCore";
import ModulesSection from "@/components/ModulesSection";
import CriticalFactors from "@/components/CriticalFactors";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <ArchitectureCore />
      <ModulesSection />
      <CriticalFactors />
      <Footer />
    </div>
  );
};

export default Index;
