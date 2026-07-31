-- 1. Körningar
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  run_type text NOT NULL,
  slot_key text,
  mode text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  target_race_date date,
  game_id text,
  track_name text,
  races_imported integer NOT NULL DEFAULT 0,
  entries_imported integer NOT NULL DEFAULT 0,
  sources_checked integer NOT NULL DEFAULT 0,
  sources_with_tips integer NOT NULL DEFAULT 0,
  sources_waiting integer NOT NULL DEFAULT 0,
  tips_imported integer NOT NULL DEFAULT 0,
  retries integer NOT NULL DEFAULT 0,
  ai_draft_created boolean NOT NULL DEFAULT false,
  error_message text,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_runs_group_started_idx ON public.automation_runs (group_id, started_at DESC);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gruppens medlemmar ser korningar" ON public.automation_runs
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

-- 2. Lås mot dubbelkörning
CREATE TABLE public.automation_locks (
  lock_key text PRIMARY KEY,
  run_id uuid,
  acquired_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.automation_locks TO service_role;
ALTER TABLE public.automation_locks ENABLE ROW LEVEL SECURITY;

-- 3. Expertkällor
CREATE TABLE public.expert_tip_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  name text NOT NULL,
  domain text,
  kind text NOT NULL DEFAULT 'search',
  enabled boolean NOT NULL DEFAULT true,
  access_note text,
  last_checked_at timestamptz,
  last_status text NOT NULL DEFAULT 'pending',
  last_message text,
  failure_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, source_key)
);
GRANT SELECT ON public.expert_tip_sources TO authenticated;
GRANT ALL ON public.expert_tip_sources TO service_role;
ALTER TABLE public.expert_tip_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gruppens medlemmar ser kallor" ON public.expert_tip_sources
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE TRIGGER expert_tip_sources_updated_at BEFORE UPDATE ON public.expert_tip_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Experttips med versionshistorik
CREATE TABLE public.expert_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  race_date date NOT NULL,
  source_id uuid REFERENCES public.expert_tip_sources(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  source_name text NOT NULL,
  tip_key text NOT NULL,
  content_hash text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  expert text,
  url text,
  published_at timestamptz,
  leg_number integer,
  top_pick text,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  longshot text,
  hedges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ranking jsonb NOT NULL DEFAULT '[]'::jsonb,
  warning text,
  note text,
  system_row text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tip_key, leg_number, content_hash)
);
CREATE INDEX expert_tips_round_idx ON public.expert_tips (group_id, race_date, is_current);
GRANT SELECT ON public.expert_tips TO authenticated;
GRANT ALL ON public.expert_tips TO service_role;
ALTER TABLE public.expert_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gruppens medlemmar ser experttips" ON public.expert_tips
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

-- 5. Faktaändringar efter torsdagsimporten
CREATE TABLE public.race_fact_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.races(id) ON DELETE CASCADE,
  race_entry_id uuid REFERENCES public.race_entries(id) ON DELETE CASCADE,
  leg_number integer,
  horse_name text,
  field text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  important boolean NOT NULL DEFAULT true,
  description text NOT NULL,
  automation_run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX race_fact_changes_round_idx ON public.race_fact_changes (round_id, detected_at DESC);
GRANT SELECT ON public.race_fact_changes TO authenticated;
GRANT ALL ON public.race_fact_changes TO service_role;
ALTER TABLE public.race_fact_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gruppens medlemmar ser faktaandringar" ON public.race_fact_changes
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));