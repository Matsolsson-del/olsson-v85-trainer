-- 1. Immutable bet snapshots
CREATE TABLE public.bet_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  system_version_id uuid REFERENCES public.system_versions(id) ON DELETE SET NULL,
  responsible_user_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  rows_count integer,
  cost numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bet_snapshots_round_unique ON public.bet_snapshots(round_id);

GRANT SELECT, INSERT ON public.bet_snapshots TO authenticated;
GRANT ALL ON public.bet_snapshots TO service_role;
ALTER TABLE public.bet_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read snapshots" ON public.bet_snapshots FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));
CREATE POLICY "Members create snapshots" ON public.bet_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id));

-- 2. Final checks before bet stop
CREATE TABLE public.final_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok',
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_checks TO authenticated;
GRANT ALL ON public.final_checks TO service_role;
ALTER TABLE public.final_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage final checks" ON public.final_checks FOR ALL TO authenticated
  USING (public.is_group_member(group_id)) WITH CHECK (public.is_group_member(group_id));

-- 3. Separation of facts / AI assessment / group decision
CREATE TABLE public.analysis_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.races(id) ON DELETE CASCADE,
  layer text NOT NULL CHECK (layer IN ('fact','ai','decision')),
  source_label text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analysis_layers_round_layer_idx ON public.analysis_layers(round_id, layer);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_layers TO authenticated;
GRANT ALL ON public.analysis_layers TO service_role;
ALTER TABLE public.analysis_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage analysis layers" ON public.analysis_layers FOR ALL TO authenticated
  USING (public.is_group_member(group_id)) WITH CHECK (public.is_group_member(group_id));
CREATE TRIGGER analysis_layers_updated_at BEFORE UPDATE ON public.analysis_layers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Richer system candidates
ALTER TABLE public.system_candidates
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weakest_assumption text,
  ADD COLUMN IF NOT EXISTS spikes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hedges jsonb NOT NULL DEFAULT '[]'::jsonb;