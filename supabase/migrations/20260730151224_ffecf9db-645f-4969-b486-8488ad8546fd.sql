
CREATE OR REPLACE FUNCTION public.submit_individual_analysis(_assessment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.individual_race_assessments%ROWTYPE; g uuid; r uuid; missing int;
BEGIN
  SELECT * INTO a FROM public.individual_race_assessments WHERE id = _assessment_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Analysen hittades inte'; END IF;
  IF a.user_id <> auth.uid() THEN RAISE EXCEPTION 'Endast egen analys kan lämnas in'; END IF;
  IF a.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Analysen är redan inlämnad'; END IF;

  SELECT ra.round_id INTO r FROM public.races ra WHERE ra.id = a.race_id;
  SELECT group_id INTO g FROM public.rounds WHERE id = r;
  IF NOT public.is_group_member(g) THEN RAISE EXCEPTION 'Ingen behörighet'; END IF;

  UPDATE public.individual_race_assessments SET submitted_at = now(), locked_at = now() WHERE id = _assessment_id;

  INSERT INTO public.activity_log (group_id, round_id, user_id, event_type, description)
  VALUES (g, r, auth.uid(), 'individual_analysis_submitted', 'Individuell analys inlämnad');

  -- Öppna automatiskt när alla medlemmar lämnat in samtliga avdelningar
  SELECT count(*) INTO missing
  FROM public.races ra
  CROSS JOIN public.group_members m
  LEFT JOIN public.individual_race_assessments ir ON ir.race_id = ra.id AND ir.user_id = m.user_id AND ir.locked_at IS NOT NULL
  WHERE ra.round_id = r AND m.group_id = g AND ir.id IS NULL;

  IF missing = 0 THEN
    UPDATE public.rounds SET analyses_revealed_at = COALESCE(analyses_revealed_at, now()),
      status = CASE WHEN status = 'individual_analysis' THEN 'analyses_revealed' ELSE status END
    WHERE id = r AND analyses_revealed_at IS NULL;
    INSERT INTO public.activity_log (group_id, round_id, user_id, event_type, description)
    VALUES (g, r, auth.uid(), 'analyses_revealed', 'Alla analyser inlämnade – analyserna öppnades automatiskt');
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.reveal_analyses_early(_round_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g uuid;
BEGIN
  SELECT group_id INTO g FROM public.rounds WHERE id = _round_id;
  IF g IS NULL THEN RAISE EXCEPTION 'Omgången hittades inte'; END IF;
  IF NOT public.is_group_owner(g) THEN RAISE EXCEPTION 'Endast gruppägare får öppna analyser i förtid'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 10 THEN RAISE EXCEPTION 'En motivering på minst 10 tecken krävs'; END IF;

  UPDATE public.rounds SET analyses_revealed_at = COALESCE(analyses_revealed_at, now()),
    status = CASE WHEN status = 'individual_analysis' THEN 'analyses_revealed' ELSE status END
  WHERE id = _round_id;

  INSERT INTO public.activity_log (group_id, round_id, user_id, event_type, description)
  VALUES (g, _round_id, auth.uid(), 'analyses_revealed_early', _reason);
END; $$;

CREATE OR REPLACE FUNCTION public.lock_system_version(_system_version_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g uuid; r uuid; v public.system_versions%ROWTYPE;
  rows_count numeric := 1; cost numeric; coverage numeric := 1;
  rec record; empty_legs int; missing_protocols int; leg_cov numeric;
BEGIN
  SELECT * INTO v FROM public.system_versions WHERE id = _system_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Systemversionen hittades inte'; END IF;
  IF v.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Systemversionen är redan låst'; END IF;

  SELECT ro.group_id, ro.id INTO g, r FROM public.systems s JOIN public.rounds ro ON ro.id = s.round_id WHERE s.id = v.system_id;
  IF NOT public.is_group_member(g) THEN RAISE EXCEPTION 'Ingen behörighet'; END IF;

  SELECT count(*) INTO empty_legs FROM public.races ra
  WHERE ra.round_id = r AND NOT EXISTS (
    SELECT 1 FROM public.system_selections ss WHERE ss.system_version_id = v.id AND ss.race_id = ra.id);
  IF empty_legs > 0 THEN RAISE EXCEPTION 'Systemet har % avdelning(ar) utan valda hästar', empty_legs; END IF;

  FOR rec IN SELECT ra.id AS race_id, count(ss.id) AS n FROM public.races ra
             JOIN public.system_selections ss ON ss.race_id = ra.id AND ss.system_version_id = v.id
             WHERE ra.round_id = r GROUP BY ra.id LOOP
    rows_count := rows_count * rec.n;
    SELECT COALESCE(SUM(gea.group_win_probability),0)/100.0 INTO leg_cov
    FROM public.system_selections ss
    JOIN public.group_race_assessments gra ON gra.race_id = rec.race_id
    JOIN public.group_entry_assessments gea ON gea.group_race_assessment_id = gra.id AND gea.race_entry_id = ss.race_entry_id
    WHERE ss.system_version_id = v.id AND ss.race_id = rec.race_id;
    coverage := coverage * COALESCE(NULLIF(leg_cov,0), 1);
  END LOOP;

  cost := rows_count * v.row_price;
  IF cost > v.budget + 0.001 THEN
    RAISE EXCEPTION 'Systemet kostar % kr och överskrider budgeten % kr', round(cost,2), v.budget;
  END IF;

  SELECT count(*) INTO missing_protocols FROM (
    SELECT ss.race_id FROM public.system_selections ss WHERE ss.system_version_id = v.id
    GROUP BY ss.race_id HAVING count(*) = 1) spikes
  LEFT JOIN public.spike_protocols sp ON sp.system_version_id = v.id AND sp.race_id = spikes.race_id
  WHERE sp.id IS NULL
     OR COALESCE(btrim(sp.expected_position),'') = '' OR COALESCE(btrim(sp.driver_assessment),'') = ''
     OR COALESCE(btrim(sp.main_strength),'') = '' OR COALESCE(btrim(sp.main_loss_risk),'') = ''
     OR COALESCE(btrim(sp.main_opponent),'') = '' OR COALESCE(btrim(sp.why_spike),'') = ''
     OR COALESCE(btrim(sp.revoke_condition),'') = '' OR sp.group_win_probability IS NULL;
  IF missing_protocols > 0 THEN
    RAISE EXCEPTION 'Spikprotokollet är ofullständigt för % avdelning(ar)', missing_protocols;
  END IF;

  UPDATE public.system_versions
  SET calculated_rows = rows_count, calculated_cost = cost, approximate_coverage = coverage,
      locked_at = now(), locked_by = auth.uid()
  WHERE id = _system_version_id;

  UPDATE public.systems SET status = 'final' WHERE id = v.system_id;
  UPDATE public.rounds SET status = 'system_locked', locked_at = COALESCE(locked_at, now())
  WHERE id = r AND status IN ('draft','individual_analysis','analyses_revealed','group_assessment','system_building');

  INSERT INTO public.activity_log (group_id, round_id, user_id, event_type, description, after_value)
  VALUES (g, r, auth.uid(), 'system_version_locked',
    format('Systemversion %s låst: %s rader, %s kr', v.version_number, rows_count, round(cost,2)),
    jsonb_build_object('rows', rows_count, 'cost', cost, 'coverage', coverage));

  RETURN jsonb_build_object('rows', rows_count, 'cost', cost, 'coverage', coverage);
END; $$;

CREATE OR REPLACE FUNCTION public.clone_system_version(_system_version_id uuid, _change_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.system_versions%ROWTYPE; g uuid; new_id uuid; next_no int;
BEGIN
  SELECT * INTO v FROM public.system_versions WHERE id = _system_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Systemversionen hittades inte'; END IF;
  g := public.system_group_id(v.system_id);
  IF NOT public.is_group_member(g) THEN RAISE EXCEPTION 'Ingen behörighet'; END IF;
  IF _change_reason IS NULL OR length(btrim(_change_reason)) < 5 THEN RAISE EXCEPTION 'En förändringsorsak krävs'; END IF;

  SELECT COALESCE(max(version_number),0)+1 INTO next_no FROM public.system_versions WHERE system_id = v.system_id;
  INSERT INTO public.system_versions (system_id, version_number, budget, row_price, change_reason)
  VALUES (v.system_id, next_no, v.budget, v.row_price, _change_reason) RETURNING id INTO new_id;

  INSERT INTO public.system_selections (system_version_id, race_id, race_entry_id)
  SELECT new_id, race_id, race_entry_id FROM public.system_selections WHERE system_version_id = v.id;

  INSERT INTO public.spike_protocols (system_version_id, race_id, race_entry_id, group_win_probability, market_percent,
    expected_position, driver_assessment, main_strength, main_loss_risk, main_opponent, why_spike, revoke_condition)
  SELECT new_id, race_id, race_entry_id, group_win_probability, market_percent, expected_position, driver_assessment,
    main_strength, main_loss_risk, main_opponent, why_spike, revoke_condition
  FROM public.spike_protocols WHERE system_version_id = v.id;

  INSERT INTO public.activity_log (group_id, user_id, event_type, description)
  VALUES (g, auth.uid(), 'system_version_cloned', format('Ny systemversion %s skapad: %s', next_no, _change_reason));

  RETURN new_id;
END; $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
