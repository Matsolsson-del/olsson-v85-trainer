
CREATE TABLE public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  product_type text NOT NULL DEFAULT 'V85',
  track_id uuid REFERENCES public.tracks(id),
  race_date date NOT NULL,
  bet_stop_at timestamptz,
  row_price numeric(6,2) NOT NULL DEFAULT 0.50,
  budget numeric(10,2) NOT NULL DEFAULT 450.00,
  status public.round_status NOT NULL DEFAULT 'draft',
  model_version_id uuid REFERENCES public.model_versions(id),
  weather_notes text,
  track_condition text,
  general_notes text,
  is_demo boolean NOT NULL DEFAULT false,
  analyses_revealed_at timestamptz,
  locked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  leg_number int NOT NULL CHECK (leg_number BETWEEN 1 AND 8),
  external_race_number int,
  name text,
  race_class text,
  start_at timestamptz,
  distance_m int,
  start_method public.start_method NOT NULL DEFAULT 'auto',
  proposition text,
  pace_notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, leg_number)
);

CREATE TABLE public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.race_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  horse_id uuid NOT NULL REFERENCES public.horses(id),
  driver_id uuid REFERENCES public.drivers(id),
  trainer_id uuid REFERENCES public.trainers(id),
  start_number int NOT NULL,
  post_position int,
  base_distance_m int,
  handicap_m int DEFAULT 0,
  age int,
  sex text,
  earnings numeric(12,2),
  record_text text,
  form_text text,
  shoe_info text,
  cart_info text,
  equipment_notes text,
  scratched boolean NOT NULL DEFAULT false,
  source_id uuid REFERENCES public.data_sources(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (race_id, start_number)
);

CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.data_sources(id),
  import_type text NOT NULL,
  raw_payload text,
  result_summary jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id uuid NOT NULL REFERENCES public.race_entries(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  bet_share_percent numeric(5,2) NOT NULL,
  source_id uuid REFERENCES public.data_sources(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- HELPERS
CREATE OR REPLACE FUNCTION public.round_group_id(_round_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT group_id FROM public.rounds WHERE id = _round_id; $$;

CREATE OR REPLACE FUNCTION public.race_round_id(_race_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round_id FROM public.races WHERE id = _race_id; $$;

CREATE OR REPLACE FUNCTION public.race_group_id(_race_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.group_id FROM public.races ra JOIN public.rounds r ON r.id = ra.round_id WHERE ra.id = _race_id; $$;

CREATE OR REPLACE FUNCTION public.entry_group_id(_entry_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.group_id FROM public.race_entries e JOIN public.races ra ON ra.id = e.race_id
  JOIN public.rounds r ON r.id = ra.round_id WHERE e.id = _entry_id; $$;

CREATE OR REPLACE FUNCTION public.race_analyses_revealed(_race_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.analyses_revealed_at IS NOT NULL FROM public.races ra JOIN public.rounds r ON r.id = ra.round_id WHERE ra.id = _race_id; $$;

-- ANALYS
CREATE TABLE public.individual_race_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spike_candidate_entry_id uuid REFERENCES public.race_entries(id) ON DELETE SET NULL,
  overbet_entry_id uuid REFERENCES public.race_entries(id) ON DELETE SET NULL,
  underbet_entry_id uuid REFERENCES public.race_entries(id) ON DELETE SET NULL,
  confidence int CHECK (confidence BETWEEN 1 AND 5),
  overall_notes text,
  submitted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (race_id, user_id)
);

CREATE TABLE public.individual_entry_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_race_assessment_id uuid NOT NULL REFERENCES public.individual_race_assessments(id) ON DELETE CASCADE,
  race_entry_id uuid NOT NULL REFERENCES public.race_entries(id) ON DELETE CASCADE,
  rank_position int,
  tier public.tier,
  estimated_win_probability numeric(5,2),
  driver_rating int CHECK (driver_rating BETWEEN -2 AND 2),
  driver_horse_rating int CHECK (driver_horse_rating BETWEEN -2 AND 2),
  include_preference public.include_preference NOT NULL DEFAULT 'neutral',
  reasoning text,
  change_condition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (individual_race_assessment_id, race_entry_id)
);

CREATE TABLE public.group_race_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL UNIQUE REFERENCES public.races(id) ON DELETE CASCADE,
  status public.assessment_status NOT NULL DEFAULT 'draft',
  likely_leader_entry_id uuid REFERENCES public.race_entries(id) ON DELETE SET NULL,
  pace_scenario text,
  confidence int CHECK (confidence BETWEEN 1 AND 5),
  primary_spike_candidate_id uuid REFERENCES public.race_entries(id) ON DELETE SET NULL,
  notes text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_entry_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_race_assessment_id uuid NOT NULL REFERENCES public.group_race_assessments(id) ON DELETE CASCADE,
  race_entry_id uuid NOT NULL REFERENCES public.race_entries(id) ON DELETE CASCADE,
  final_rank int,
  tier public.tier,
  group_win_probability numeric(5,2) NOT NULL DEFAULT 0,
  driver_rating int CHECK (driver_rating BETWEEN -2 AND 2),
  driver_horse_rating int CHECK (driver_horse_rating BETWEEN -2 AND 2),
  must_include boolean NOT NULL DEFAULT false,
  active_exclusion boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  value_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_race_assessment_id, race_entry_id)
);

CREATE TABLE public.ai_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.races(id) ON DELETE CASCADE,
  run_type text NOT NULL,
  prompt_version text NOT NULL DEFAULT 'v1',
  input_reference jsonb,
  response text,
  approved boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Skydd: låst individuell analys får ej ändras
CREATE OR REPLACE FUNCTION public.protect_locked_individual() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Inlämnad analys är låst och kan inte ändras'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_protect_ira BEFORE UPDATE OR DELETE ON public.individual_race_assessments
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_individual();

CREATE OR REPLACE FUNCTION public.protect_locked_individual_entry() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l timestamptz;
BEGIN
  SELECT locked_at INTO l FROM public.individual_race_assessments WHERE id = COALESCE(NEW.individual_race_assessment_id, OLD.individual_race_assessment_id);
  IF l IS NOT NULL THEN RAISE EXCEPTION 'Inlämnad analys är låst och kan inte ändras'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_protect_iea BEFORE INSERT OR UPDATE OR DELETE ON public.individual_entry_assessments
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_individual_entry();

-- Skydd: låst gruppbedömning + 100 %-krav vid låsning
CREATE OR REPLACE FUNCTION public.protect_group_assessment() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total numeric;
BEGIN
  IF OLD.status = 'locked' THEN RAISE EXCEPTION 'Låst gruppbedömning kan inte ändras'; END IF;
  IF NEW.status = 'locked' THEN
    SELECT COALESCE(SUM(group_win_probability),0) INTO total FROM public.group_entry_assessments WHERE group_race_assessment_id = NEW.id;
    IF abs(total - 100) > 0.01 THEN
      RAISE EXCEPTION 'Gruppens vinstchanser måste summera till 100 procent (nu %).', total;
    END IF;
    NEW.locked_at = COALESCE(NEW.locked_at, now());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_protect_gra BEFORE UPDATE ON public.group_race_assessments
FOR EACH ROW EXECUTE FUNCTION public.protect_group_assessment();

CREATE OR REPLACE FUNCTION public.protect_group_entry() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.assessment_status;
BEGIN
  SELECT status INTO s FROM public.group_race_assessments WHERE id = COALESCE(NEW.group_race_assessment_id, OLD.group_race_assessment_id);
  IF s = 'locked' THEN RAISE EXCEPTION 'Låst gruppbedömning kan inte ändras'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_protect_gea BEFORE INSERT OR UPDATE OR DELETE ON public.group_entry_assessments
FOR EACH ROW EXECUTE FUNCTION public.protect_group_entry();

-- RLS
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_race_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_entry_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_race_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_entry_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_rounds_sel ON public.rounds FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY p_rounds_ins ON public.rounds FOR INSERT TO authenticated WITH CHECK (public.is_group_owner(group_id) AND created_by = auth.uid());
CREATE POLICY p_rounds_upd ON public.rounds FOR UPDATE TO authenticated USING (public.is_group_member(group_id)) WITH CHECK (public.is_group_member(group_id));
CREATE POLICY p_rounds_del ON public.rounds FOR DELETE TO authenticated USING (public.is_group_owner(group_id));

CREATE POLICY p_races_all ON public.races FOR ALL TO authenticated
  USING (public.is_group_member(public.round_group_id(round_id)))
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)));

CREATE POLICY p_entries_all ON public.race_entries FOR ALL TO authenticated
  USING (public.is_group_member(public.race_group_id(race_id)))
  WITH CHECK (public.is_group_member(public.race_group_id(race_id)));

CREATE POLICY p_ds_all ON public.data_sources FOR ALL TO authenticated
  USING (public.is_group_member(group_id)) WITH CHECK (public.is_group_member(group_id));

CREATE POLICY p_di_all ON public.data_imports FOR ALL TO authenticated
  USING (public.is_group_member(public.round_group_id(round_id)))
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)) AND created_by = auth.uid());

CREATE POLICY p_ms_sel ON public.market_snapshots FOR SELECT TO authenticated
  USING (public.is_group_member(public.entry_group_id(race_entry_id)));
CREATE POLICY p_ms_ins ON public.market_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(public.entry_group_id(race_entry_id)));

CREATE POLICY p_ira_sel ON public.individual_race_assessments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.race_analyses_revealed(race_id) AND public.is_group_member(public.race_group_id(race_id))));
CREATE POLICY p_ira_ins ON public.individual_race_assessments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(public.race_group_id(race_id)));
CREATE POLICY p_ira_upd ON public.individual_race_assessments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_ira_del ON public.individual_race_assessments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY p_iea_sel ON public.individual_entry_assessments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.individual_race_assessments a WHERE a.id = individual_race_assessment_id
    AND (a.user_id = auth.uid() OR (public.race_analyses_revealed(a.race_id) AND public.is_group_member(public.race_group_id(a.race_id))))));
CREATE POLICY p_iea_write ON public.individual_entry_assessments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.individual_race_assessments a WHERE a.id = individual_race_assessment_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.individual_race_assessments a WHERE a.id = individual_race_assessment_id AND a.user_id = auth.uid()));

CREATE POLICY p_gra_all ON public.group_race_assessments FOR ALL TO authenticated
  USING (public.is_group_member(public.race_group_id(race_id)))
  WITH CHECK (public.is_group_member(public.race_group_id(race_id)));

CREATE POLICY p_gea_all ON public.group_entry_assessments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.group_race_assessments g WHERE g.id = group_race_assessment_id AND public.is_group_member(public.race_group_id(g.race_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.group_race_assessments g WHERE g.id = group_race_assessment_id AND public.is_group_member(public.race_group_id(g.race_id))));

CREATE POLICY p_ai_all ON public.ai_analysis_runs FOR ALL TO authenticated
  USING (public.is_group_member(group_id)) WITH CHECK (public.is_group_member(group_id) AND created_by = auth.uid());

DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;
END $$;

CREATE TRIGGER t_rounds_upd BEFORE UPDATE ON public.rounds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_races_upd BEFORE UPDATE ON public.races FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_entries_upd BEFORE UPDATE ON public.race_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
