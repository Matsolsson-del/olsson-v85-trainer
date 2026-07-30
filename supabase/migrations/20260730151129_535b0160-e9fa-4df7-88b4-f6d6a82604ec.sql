
CREATE TABLE public.systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status public.system_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  budget numeric(10,2) NOT NULL,
  row_price numeric(6,2) NOT NULL,
  calculated_rows int NOT NULL DEFAULT 0,
  calculated_cost numeric(12,2) NOT NULL DEFAULT 0,
  approximate_coverage numeric(6,4),
  change_reason text,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_id, version_number)
);

CREATE TABLE public.system_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_version_id uuid NOT NULL REFERENCES public.system_versions(id) ON DELETE CASCADE,
  race_id uuid NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  race_entry_id uuid NOT NULL REFERENCES public.race_entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_version_id, race_id, race_entry_id)
);

CREATE TABLE public.spike_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_version_id uuid NOT NULL REFERENCES public.system_versions(id) ON DELETE CASCADE,
  race_id uuid NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  race_entry_id uuid NOT NULL REFERENCES public.race_entries(id) ON DELETE CASCADE,
  group_win_probability numeric(5,2),
  market_percent numeric(5,2),
  expected_position text,
  driver_assessment text,
  main_strength text,
  main_loss_risk text,
  main_opponent text,
  why_spike text,
  revoke_condition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_version_id, race_id)
);

CREATE TABLE public.race_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL UNIQUE REFERENCES public.races(id) ON DELETE CASCADE,
  winner_entry_id uuid REFERENCES public.race_entries(id) ON DELETE SET NULL,
  result_source_id uuid REFERENCES public.data_sources(id),
  final_market_snapshot_at timestamptz,
  notable_event text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid NOT NULL REFERENCES auth.users(id)
);

CREATE TABLE public.entry_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_result_id uuid NOT NULL REFERENCES public.race_results(id) ON DELETE CASCADE,
  race_entry_id uuid NOT NULL REFERENCES public.race_entries(id) ON DELETE CASCADE,
  finish_position int,
  disqualified boolean NOT NULL DEFAULT false,
  galloped boolean NOT NULL DEFAULT false,
  event_notes text,
  UNIQUE (race_result_id, race_entry_id)
);

CREATE TABLE public.round_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL UNIQUE REFERENCES public.rounds(id) ON DELETE CASCADE,
  v85_payout numeric(12,2),
  group_winnings numeric(12,2) NOT NULL DEFAULT 0,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.race_postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL UNIQUE REFERENCES public.races(id) ON DELETE CASCADE,
  expected_scenario text,
  actual_scenario text,
  driver_execution public.driver_execution NOT NULL DEFAULT 'not_assessed',
  primary_error_category public.error_category,
  unpredictable_event_description text,
  preventable boolean,
  winner_was_selected boolean,
  process_quality int CHECK (process_quality BETWEEN 1 AND 5),
  concrete_lesson text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.round_postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL UNIQUE REFERENCES public.rounds(id) ON DELETE CASCADE,
  strengths text,
  three_main_errors text,
  good_decisions_despite_loss text,
  bad_decisions_despite_win text,
  max_three_changes_to_test text,
  do_not_change_yet text,
  ai_draft text,
  approved_text text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.learning_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  description text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_type public.transaction_type NOT NULL,
  amount numeric(12,2) NOT NULL,
  transaction_date date NOT NULL DEFAULT current_date,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Immutabilitet för låsta systemversioner
CREATE OR REPLACE FUNCTION public.protect_locked_system_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Låst systemversion kan inte ändras eller raderas'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_protect_sv BEFORE UPDATE OR DELETE ON public.system_versions
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_system_version();

CREATE OR REPLACE FUNCTION public.protect_locked_children() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l timestamptz;
BEGIN
  SELECT locked_at INTO l FROM public.system_versions WHERE id = COALESCE(NEW.system_version_id, OLD.system_version_id);
  IF l IS NOT NULL THEN RAISE EXCEPTION 'Låst systemversion kan inte ändras'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_protect_sel BEFORE INSERT OR UPDATE OR DELETE ON public.system_selections
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_children();
CREATE TRIGGER t_protect_sp BEFORE INSERT OR UPDATE OR DELETE ON public.spike_protocols
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_children();

CREATE OR REPLACE FUNCTION public.system_group_id(_system_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.group_id FROM public.systems s JOIN public.rounds r ON r.id = s.round_id WHERE s.id = _system_id; $$;

CREATE OR REPLACE FUNCTION public.system_version_group_id(_sv_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.group_id FROM public.system_versions v JOIN public.systems s ON s.id = v.system_id
  JOIN public.rounds r ON r.id = s.round_id WHERE v.id = _sv_id; $$;

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spike_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_postmortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_postmortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_sys_all ON public.systems FOR ALL TO authenticated
  USING (public.is_group_member(public.round_group_id(round_id)))
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)));

CREATE POLICY p_sv_all ON public.system_versions FOR ALL TO authenticated
  USING (public.is_group_member(public.system_group_id(system_id)))
  WITH CHECK (public.is_group_member(public.system_group_id(system_id)));

CREATE POLICY p_ssel_all ON public.system_selections FOR ALL TO authenticated
  USING (public.is_group_member(public.system_version_group_id(system_version_id)))
  WITH CHECK (public.is_group_member(public.system_version_group_id(system_version_id)));

CREATE POLICY p_sp_all ON public.spike_protocols FOR ALL TO authenticated
  USING (public.is_group_member(public.system_version_group_id(system_version_id)))
  WITH CHECK (public.is_group_member(public.system_version_group_id(system_version_id)));

CREATE POLICY p_rr_all ON public.race_results FOR ALL TO authenticated
  USING (public.is_group_member(public.race_group_id(race_id)))
  WITH CHECK (public.is_group_member(public.race_group_id(race_id)));

CREATE POLICY p_er_all ON public.entry_results FOR ALL TO authenticated
  USING (public.is_group_member(public.entry_group_id(race_entry_id)))
  WITH CHECK (public.is_group_member(public.entry_group_id(race_entry_id)));

CREATE POLICY p_rores_all ON public.round_results FOR ALL TO authenticated
  USING (public.is_group_member(public.round_group_id(round_id)))
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)));

CREATE POLICY p_rpm_all ON public.race_postmortems FOR ALL TO authenticated
  USING (public.is_group_member(public.race_group_id(race_id)))
  WITH CHECK (public.is_group_member(public.race_group_id(race_id)));

CREATE POLICY p_ropm_all ON public.round_postmortems FOR ALL TO authenticated
  USING (public.is_group_member(public.round_group_id(round_id)))
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)));

CREATE POLICY p_lh_all ON public.learning_hypotheses FOR ALL TO authenticated
  USING (public.is_group_member(group_id)) WITH CHECK (public.is_group_member(group_id));

CREATE POLICY p_com_sel ON public.comments FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY p_com_ins ON public.comments FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id) AND created_by = auth.uid());
CREATE POLICY p_com_del ON public.comments FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY p_al_sel ON public.activity_log FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY p_al_ins ON public.activity_log FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id) AND user_id = auth.uid());

CREATE POLICY p_not_sel ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY p_not_ins ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id));
CREATE POLICY p_not_upd ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY p_lt_sel ON public.ledger_transactions FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY p_lt_ins ON public.ledger_transactions FOR INSERT TO authenticated WITH CHECK (public.is_group_owner(group_id) AND created_by = auth.uid());
CREATE POLICY p_lt_upd ON public.ledger_transactions FOR UPDATE TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY p_lt_del ON public.ledger_transactions FOR DELETE TO authenticated USING (public.is_group_owner(group_id));

DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;
END $$;

-- Ingen anonym åtkomst till hjälpfunktioner
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

CREATE TRIGGER t_sys_upd BEFORE UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
