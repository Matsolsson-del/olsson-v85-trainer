CREATE TABLE public.expert_tips_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  race_date date NOT NULL,
  track_name text,
  status text NOT NULL DEFAULT 'ready',
  summary text,
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  consensus jsonb NOT NULL DEFAULT '[]'::jsonb,
  disagreements jsonb NOT NULL DEFAULT '[]'::jsonb,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  error_message text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX expert_tips_reports_group_date_idx ON public.expert_tips_reports (group_id, race_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_tips_reports TO authenticated;
GRANT ALL ON public.expert_tips_reports TO service_role;

ALTER TABLE public.expert_tips_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gruppens medlemmar ser experttips"
  ON public.expert_tips_reports FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "Gruppens medlemmar skapar experttips"
  ON public.expert_tips_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "Gruppens medlemmar uppdaterar experttips"
  ON public.expert_tips_reports FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "Gruppens medlemmar tar bort experttips"
  ON public.expert_tips_reports FOR DELETE TO authenticated
  USING (public.is_group_member(group_id));

CREATE TRIGGER expert_tips_reports_updated_at
  BEFORE UPDATE ON public.expert_tips_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();