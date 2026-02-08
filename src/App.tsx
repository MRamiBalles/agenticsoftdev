import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ConstitutionPage from "./pages/ConstitutionPage";
import DecisionsPage from "./pages/DecisionsPage";
import AdminPage from "./pages/AdminPage";
import ProjectsPage from "./pages/ProjectsPage";
import PipelinePage from "./pages/PipelinePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/constitution" element={<ConstitutionPage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/pipeline/:projectId" element={<PipelinePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
