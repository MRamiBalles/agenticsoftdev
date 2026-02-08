
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Rule categories
CREATE TABLE public.rule_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT 'primary',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rule_categories ENABLE ROW LEVEL SECURITY;

-- 5. Constitution rules
CREATE TABLE public.constitution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.rule_categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  version INT NOT NULL DEFAULT 1,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.constitution_rules ENABLE ROW LEVEL SECURITY;

-- 6. Decision records (ADR)
CREATE TABLE public.decision_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'deprecated', 'superseded')),
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  consequences TEXT,
  alternatives_considered JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.decision_records ENABLE ROW LEVEL SECURITY;

-- 7. ADR-Rule links
CREATE TABLE public.adr_rule_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adr_id UUID REFERENCES public.decision_records(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID REFERENCES public.constitution_rules(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (adr_id, rule_id)
);
ALTER TABLE public.adr_rule_links ENABLE ROW LEVEL SECURITY;

-- 8. Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- HELPER FUNCTIONS (security definer)
-- ========================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ========================================
-- TRIGGER: Auto-create profile + default role on signup
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- TRIGGER: Auto-update updated_at
-- ========================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_constitution_rules_updated_at BEFORE UPDATE ON public.constitution_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_decision_records_updated_at BEFORE UPDATE ON public.decision_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================================
-- TRIGGER: Activity logging
-- ========================================
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log (user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER log_constitution_rules_changes AFTER INSERT OR UPDATE OR DELETE ON public.constitution_rules FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_decision_records_changes AFTER INSERT OR UPDATE OR DELETE ON public.decision_records FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- ========================================
-- RLS POLICIES
-- ========================================

-- user_roles: admins manage, users read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin());

-- profiles: users read/update own, admins read all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

-- rule_categories: public read, admin CRUD
CREATE POLICY "Anyone can read categories" ON public.rule_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.rule_categories FOR ALL USING (public.is_admin());

-- constitution_rules: public read, admin CRUD
CREATE POLICY "Anyone can read rules" ON public.constitution_rules FOR SELECT USING (true);
CREATE POLICY "Admins can manage rules" ON public.constitution_rules FOR ALL USING (public.is_admin());

-- decision_records: authenticated read, admin CRUD
CREATE POLICY "Authenticated can read ADRs" ON public.decision_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage ADRs" ON public.decision_records FOR ALL USING (public.is_admin());

-- adr_rule_links: authenticated read, admin CRUD
CREATE POLICY "Authenticated can read ADR links" ON public.adr_rule_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage ADR links" ON public.adr_rule_links FOR ALL USING (public.is_admin());

-- activity_log: authenticated read, system insert (via trigger)
CREATE POLICY "Authenticated can read logs" ON public.activity_log FOR SELECT USING (auth.uid() IS NOT NULL);

-- ========================================
-- SEED DATA: Categories
-- ========================================
INSERT INTO public.rule_categories (name, description, icon, color, sort_order) VALUES
  ('Gobernanza ISO 42001', 'Reglas de cumplimiento normativo, aprobaciones humanas, trazabilidad y evidencia documental', 'Shield', 'accent', 1),
  ('Calidad Técnica (ATDI)', 'Umbrales de deuda técnica, architectural smells, cobertura de tests y estándares de código', 'ShieldCheck', 'primary', 2),
  ('Stack y Estilo', 'Tecnologías aprobadas, patrones de diseño, convenciones de nomenclatura y anti-patterns prohibidos', 'Code2', 'primary', 3);

-- SEED DATA: Initial constitution rules
INSERT INTO public.constitution_rules (category_id, name, description, rationale, severity, is_locked, code) VALUES
  ((SELECT id FROM public.rule_categories WHERE name = 'Gobernanza ISO 42001'),
   'Regla de Hierro: Aprobación Humana',
   'Ningún despliegue a producción sin firma criptográfica de un humano con rol "Accountable" en la Matriz RACI.',
   'ISO 42001 requiere trazabilidad completa de decisiones algorítmicas. Un humano debe ser legalmente responsable de cada despliegue.',
   'critical', true, 'GOV-001'),
  
  ((SELECT id FROM public.rule_categories WHERE name = 'Gobernanza ISO 42001'),
   'Trazabilidad de Decisiones IA',
   'Toda decisión tomada por un agente debe documentarse automáticamente con: timestamp, contexto, alternativas evaluadas y justificación.',
   'El marco MAD-BAD-SAD exige transparencia total en la toma de decisiones algorítmicas para prevenir zonas de deformación moral.',
   'critical', true, 'GOV-002'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Gobernanza ISO 42001'),
   'Matriz RACI Dinámica',
   'Cada tarea crítica debe tener asignados los roles Responsible, Accountable, Consulted e Informed antes de ejecutarse.',
   'Previene la difusión de responsabilidad entre agentes humanos y algorítmicos.',
   'high', true, 'GOV-003'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Calidad Técnica (ATDI)'),
   'Umbral de Deuda Técnica',
   'Rechazo automático de cualquier PR que aumente el ATDI por encima del 5% respecto a la línea base del proyecto.',
   'ATDI = Σ(Severidad_AS × Tamaño_LOC). Los architectural smells degradan exponencialmente la mantenibilidad.',
   'critical', true, 'ATDI-001'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Calidad Técnica (ATDI)'),
   'Explicabilidad de Rechazos (SHAP)',
   'Si el Guardian Agent rechaza un PR, debe proporcionar valores SHAP identificando exactamente qué variable disparó el rechazo.',
   'La explicabilidad es un requisito de ISO 42001 y reduce la fricción humano-agente.',
   'high', false, 'ATDI-002'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Calidad Técnica (ATDI)'),
   'Tests Spec-First',
   'Los tests unitarios y de integración deben generarse ANTES o DURANTE la generación del código, basados en criterios de aceptación.',
   'El TDD agéntico elimina la tendencia del "vibe coding" donde los tests son un afterthought.',
   'high', false, 'ATDI-003'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Stack y Estilo'),
   'Prohibición de Vibe Coding',
   'Ningún código generado por IA puede commitearse sin validación contra spec.md. El Verificador de Especificación debe aprobar cada bloque.',
   'El código improvisado genera deuda técnica invisible. La especificación es la fuente de la verdad, no la creatividad del agente.',
   'critical', true, 'STYLE-001'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Stack y Estilo'),
   'Constitution como Contexto Inmutable',
   'El archivo constitution.md debe inyectarse como contexto system en cada prompt de los agentes. No puede ser modificado por agentes.',
   'Garantiza que los agentes operen dentro de los límites definidos por humanos, previniendo drift arquitectónico.',
   'critical', true, 'STYLE-002'),

  ((SELECT id FROM public.rule_categories WHERE name = 'Stack y Estilo'),
   'Convenciones de Nomenclatura',
   'Todos los artefactos deben seguir la convención: {módulo}-{tipo}-{nombre}. Ejemplo: gov-rule-deployment-approval.',
   'La nomenclatura consistente facilita la navegación por agentes y humanos en repositorios grandes.',
   'medium', false, 'STYLE-003');

-- SEED DATA: Initial ADR
INSERT INTO public.decision_records (title, status, context, decision, consequences, alternatives_considered) VALUES
  ('ADR-001: Adopción de Spec-Driven Development como paradigma central',
   'accepted',
   'El desarrollo tradicional con IA genera "vibe coding" — código funcional pero sin estructura, difícil de mantener y auditar. Necesitamos un paradigma que ponga la especificación como fuente de la verdad.',
   'Adoptamos Spec-Driven Development (SDD) con GitHub Spec Kit como gestor del repositorio central de especificaciones vivas (spec.md, plan.md, tasks.md).',
   'Curva de aprendizaje inicial para equipos acostumbrados a desarrollo ad-hoc. Mayor overhead en la fase de planificación pero reducción significativa de retrabajo y deuda técnica.',
   '[{"option": "Test-Driven Development (TDD) puro", "reason_rejected": "TDD solo cubre código, no arquitectura ni gobernanza. No previene deuda técnica arquitectónica."}, {"option": "Model-Driven Development (MDD)", "reason_rejected": "Demasiado rígido para entornos ágiles. Los modelos se desactualizan rápidamente."}, {"option": "Vibe Coding con revisión posterior", "reason_rejected": "Genera deuda técnica exponencial. Incompatible con ISO 42001 y auditorías."}]'::jsonb);
