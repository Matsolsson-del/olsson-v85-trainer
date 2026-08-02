ALTER TABLE public.system_selections ADD COLUMN IF NOT EXISTS reserve_order integer;

CREATE TABLE IF NOT EXISTS public.round_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  system_version_id uuid REFERENCES public.system_versions(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  verification text NOT NULL DEFAULT 'needs_review',
  source text,
  source_url text,
  official_game_id text,
  race_date date,
  track_name text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  scratches jsonb NOT NULL DEFAULT '[]'::jsonb,
  payouts jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  system_cost numeric(12,2),
  fee numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2),
  payout_total numeric(12,2),
  net numeric(12,2),
  return_percent numeric(8,2),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_round_settlements_round ON public.round_settlements(round_id);

GRANT SELECT ON public.round_settlements TO authenticated;
GRANT ALL ON public.round_settlements TO service_role;

ALTER TABLE public.round_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_rset_select" ON public.round_settlements
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

DROP TRIGGER IF EXISTS t_rset_upd ON public.round_settlements;
CREATE TRIGGER t_rset_upd BEFORE UPDATE ON public.round_settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();