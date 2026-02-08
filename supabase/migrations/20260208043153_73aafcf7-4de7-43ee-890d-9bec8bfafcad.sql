
-- SDD Projects
CREATE TABLE public.sdd_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  methodology TEXT NOT NULL DEFAULT 'sdd_strict' CHECK (methodology IN ('sdd_strict', 'agile_iterative')),
  current_phase TEXT NOT NULL DEFAULT 'constitute' CHECK (current_phase IN ('constitute', 'specify', 'plan', 'tasks', 'implement')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sdd_projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sdd_projects_updated_at BEFORE UPDATE ON public.sdd_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- SDD Documents (the living specs)
CREATE TABLE public.sdd_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.sdd_projects(id) ON DELETE CASCADE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('constitute', 'specify', 'plan', 'tasks', 'implement')),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('constitution', 'spec', 'plan', 'tasks', 'code_review', 'atdi_report')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected')),
  version INT NOT NULL DEFAULT 1,
  generated_by TEXT DEFAULT 'human' CHECK (generated_by IN ('human', 'agent')),
  reviewed_by UUID REFERENCES auth.users(id),
  review_comment TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sdd_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sdd_documents_updated_at BEFORE UPDATE ON public.sdd_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- SDD Agent Messages (chat log for each phase)
CREATE TABLE public.sdd_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.sdd_projects(id) ON DELETE CASCADE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('constitute', 'specify', 'plan', 'tasks', 'implement')),
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  agent_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sdd_agent_messages ENABLE ROW LEVEL SECURITY;

-- Activity logging for SDD tables
CREATE TRIGGER log_sdd_projects_changes AFTER INSERT OR UPDATE OR DELETE ON public.sdd_projects FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_sdd_documents_changes AFTER INSERT OR UPDATE OR DELETE ON public.sdd_documents FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- RLS Policies

-- sdd_projects: owner + admins
CREATE POLICY "Users can read own projects" ON public.sdd_projects FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Admins can read all projects" ON public.sdd_projects FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can create projects" ON public.sdd_projects FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own projects" ON public.sdd_projects FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Admins can manage projects" ON public.sdd_projects FOR ALL USING (public.is_admin());

-- sdd_documents: project owner + admins
CREATE POLICY "Users can read own project docs" ON public.sdd_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sdd_projects WHERE id = project_id AND created_by = auth.uid())
);
CREATE POLICY "Admins can read all docs" ON public.sdd_documents FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can create docs for own projects" ON public.sdd_documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sdd_projects WHERE id = project_id AND created_by = auth.uid())
);
CREATE POLICY "Users can update own project docs" ON public.sdd_documents FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.sdd_projects WHERE id = project_id AND created_by = auth.uid())
);
CREATE POLICY "Admins can manage docs" ON public.sdd_documents FOR ALL USING (public.is_admin());

-- sdd_agent_messages: project owner + admins
CREATE POLICY "Users can read own project messages" ON public.sdd_agent_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sdd_projects WHERE id = project_id AND created_by = auth.uid())
);
CREATE POLICY "Admins can read all messages" ON public.sdd_agent_messages FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can create messages for own projects" ON public.sdd_agent_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sdd_projects WHERE id = project_id AND created_by = auth.uid())
);
CREATE POLICY "Admins can manage messages" ON public.sdd_agent_messages FOR ALL USING (public.is_admin());
