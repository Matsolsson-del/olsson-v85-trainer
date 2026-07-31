CREATE TABLE public.imported_history_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'imported_history',
  track_name text,
  race_date date NOT NULL,
  bet_stop_at timestamptz,
  budget numeric,
  row_price numeric,
  stated_cost numeric,
  computed_cost numeric,
  stated_rows integer,
  computed_rows integer,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  spikes jsonb NOT NULL DEFAULT '[]'::jsonb,
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  winners_verified boolean NOT NULL DEFAULT false,
  correct_count integer,
  spike_hits integer,
  payout numeric,
  net_result numeric,
  analysis text,
  lessons text,
  data_quality text NOT NULL DEFAULT 'incomplete',
  source text,
  uncertainty_note text,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  usable_for_learning boolean NOT NULL DEFAULT false,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imported_history_rounds_idem_unique UNIQUE (group_id, idempotency_key),
  CONSTRAINT imported_history_rounds_quality_check CHECK (data_quality IN ('verified','partially_verified','incomplete')),
  CONSTRAINT imported_history_rounds_status_check CHECK (status IN ('imported_history'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_history_rounds TO authenticated;
GRANT ALL ON public.imported_history_rounds TO service_role;

ALTER TABLE public.imported_history_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_select_members" ON public.imported_history_rounds
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

CREATE POLICY "history_insert_members" ON public.imported_history_rounds
  FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id) AND imported_by = auth.uid());

CREATE POLICY "history_update_owner" ON public.imported_history_rounds
  FOR UPDATE TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));

CREATE POLICY "history_delete_owner" ON public.imported_history_rounds
  FOR DELETE TO authenticated USING (public.is_group_owner(group_id));

CREATE TRIGGER imported_history_rounds_updated_at
  BEFORE UPDATE ON public.imported_history_rounds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX imported_history_rounds_group_date_idx
  ON public.imported_history_rounds (group_id, race_date DESC);