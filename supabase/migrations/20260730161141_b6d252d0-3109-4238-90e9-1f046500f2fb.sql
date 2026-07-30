CREATE TABLE public.personal_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE,
  rounds_analyzed integer NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  strengths text,
  improvements text,
  next_focus text,
  model_used text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_recommendations TO authenticated;
GRANT ALL ON public.personal_recommendations TO service_role;

ALTER TABLE public.personal_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Egna rekommendationer" ON public.personal_recommendations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));

CREATE INDEX idx_personal_recommendations_user ON public.personal_recommendations(user_id, created_at DESC);

CREATE TRIGGER set_personal_recommendations_updated_at
  BEFORE UPDATE ON public.personal_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();