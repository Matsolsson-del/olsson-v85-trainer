-- 1. Klassificering av experttips
ALTER TABLE public.expert_tips
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'expert_tip',
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS game_type_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS expert_tips_classification_idx
  ON public.expert_tips (group_id, race_date, classification, is_current);

-- 2. Kandidatsidor som prövats men inte sparats som tips
CREATE TABLE IF NOT EXISTS public.expert_tip_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  round_id uuid,
  automation_run_id uuid,
  race_date date NOT NULL,
  source_key text NOT NULL,
  source_name text NOT NULL,
  url text NOT NULL,
  title text,
  classification text NOT NULL,
  code text NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  game_type_verified boolean NOT NULL DEFAULT false,
  date_verified boolean NOT NULL DEFAULT false,
  track_verified boolean NOT NULL DEFAULT false,
  tip_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.expert_tip_candidates TO authenticated;
GRANT ALL ON public.expert_tip_candidates TO service_role;
ALTER TABLE public.expert_tip_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gruppens medlemmar kan se kandidatsidor" ON public.expert_tip_candidates;
CREATE POLICY "Gruppens medlemmar kan se kandidatsidor"
  ON public.expert_tip_candidates FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE INDEX IF NOT EXISTS expert_tip_candidates_lookup_idx
  ON public.expert_tip_candidates (group_id, race_date, created_at DESC);

-- 3. Utökad körlogg
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Stockholm',
  ADD COLUMN IF NOT EXISTS delay_seconds integer,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidates_found integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidates_rejected integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidates_reclassified integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_new integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_updated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_unchanged integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_duplicates integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_verified_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accounting_note text;

-- 4. Utökat källregister
ALTER TABLE public.expert_tip_sources
  ADD COLUMN IF NOT EXISTS allowed_url_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reject_url_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_games jsonb NOT NULL DEFAULT '["V85"]'::jsonb,
  ADD COLUMN IF NOT EXISTS paywall boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_interval_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS last_verified_tip_at timestamptz,
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'unknown';