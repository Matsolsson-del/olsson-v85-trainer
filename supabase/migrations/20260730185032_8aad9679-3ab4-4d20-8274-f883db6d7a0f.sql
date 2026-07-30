CREATE TABLE public.ai_import_settings (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  key_hash text,
  key_prefix text,
  key_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_import_settings TO authenticated;
GRANT ALL ON public.ai_import_settings TO service_role;
ALTER TABLE public.ai_import_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se inställningar" ON public.ai_import_settings FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE TRIGGER ai_import_settings_updated BEFORE UPDATE ON public.ai_import_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_import_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'ai_draft',
  idempotency_key text NOT NULL,
  external_round_id text,
  track_name text,
  race_date date,
  bet_stop_at timestamptz,
  analyzed_at timestamptz,
  analysis_version text,
  model_name text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  main_recommendation text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, version),
  UNIQUE (group_id, idempotency_key)
);
GRANT SELECT ON public.ai_import_versions TO authenticated;
GRANT ALL ON public.ai_import_versions TO service_role;
ALTER TABLE public.ai_import_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se AI-importer" ON public.ai_import_versions FOR SELECT TO authenticated USING (public.is_group_member(group_id));

CREATE TABLE public.ai_import_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  ok boolean NOT NULL DEFAULT false,
  status_code integer NOT NULL DEFAULT 200,
  message text,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key text,
  version_id uuid REFERENCES public.ai_import_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_import_attempts TO authenticated;
GRANT ALL ON public.ai_import_attempts TO service_role;
ALTER TABLE public.ai_import_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se importförsök" ON public.ai_import_attempts FOR SELECT TO authenticated USING (group_id IS NOT NULL AND public.is_group_member(group_id));
CREATE INDEX ai_import_attempts_created_idx ON public.ai_import_attempts (created_at DESC);