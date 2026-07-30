-- Helper: is the current user the weekly responsible for a round?
CREATE TABLE public.responsibility_rotation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsibility_rotation TO authenticated;
GRANT ALL ON public.responsibility_rotation TO service_role;
ALTER TABLE public.responsibility_rotation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotation_select" ON public.responsibility_rotation FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY "rotation_owner_write" ON public.responsibility_rotation FOR ALL TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE TRIGGER responsibility_rotation_updated_at BEFORE UPDATE ON public.responsibility_rotation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.round_responsibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL UNIQUE REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  replaced_user_id uuid REFERENCES auth.users(id),
  change_reason text,
  rotation_mode text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT round_responsibility_change_reason_required CHECK (replaced_user_id IS NULL OR (change_reason IS NOT NULL AND length(btrim(change_reason)) > 0)),
  CONSTRAINT round_responsibility_rotation_mode_valid CHECK (rotation_mode IN ('normal', 'continue', 'move_last'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_responsibility TO authenticated;
GRANT ALL ON public.round_responsibility TO service_role;
ALTER TABLE public.round_responsibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "round_resp_select" ON public.round_responsibility FOR SELECT TO authenticated USING (public.is_group_member(public.round_group_id(round_id)));
CREATE POLICY "round_resp_insert" ON public.round_responsibility FOR INSERT TO authenticated WITH CHECK (public.is_group_member(public.round_group_id(round_id)));
CREATE POLICY "round_resp_update" ON public.round_responsibility FOR UPDATE TO authenticated
  USING (public.is_group_owner(public.round_group_id(round_id)) OR user_id = auth.uid())
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)));
CREATE TRIGGER round_responsibility_updated_at BEFORE UPDATE ON public.round_responsibility FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_round_responsible(_round_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.round_responsibility rr WHERE rr.round_id = _round_id AND rr.user_id = auth.uid());
$$;

-- Automation jobs
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  schedule_cron text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_select" ON public.jobs FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY "jobs_owner_write" ON public.jobs FOR ALL TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text,
  log jsonb,
  triggered_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_runs_status_valid CHECK (status IN ('running', 'success', 'failed', 'needs_manual'))
);
GRANT SELECT, INSERT ON public.job_runs TO authenticated;
GRANT ALL ON public.job_runs TO service_role;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_runs_select" ON public.job_runs FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY "job_runs_insert" ON public.job_runs FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id));

-- Data quality
CREATE TABLE public.data_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.races(id) ON DELETE CASCADE,
  score integer,
  missing_fields jsonb,
  warnings jsonb,
  sufficient_for_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.data_quality_reports TO authenticated;
GRANT ALL ON public.data_quality_reports TO service_role;
ALTER TABLE public.data_quality_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dq_select" ON public.data_quality_reports FOR SELECT TO authenticated USING (public.is_group_member(public.round_group_id(round_id)));
CREATE POLICY "dq_insert" ON public.data_quality_reports FOR INSERT TO authenticated WITH CHECK (public.is_group_member(public.round_group_id(round_id)));

-- AI system candidates
CREATE TABLE public.system_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  ai_analysis_run_id uuid REFERENCES public.ai_analysis_runs(id) ON DELETE SET NULL,
  profile text NOT NULL,
  title text NOT NULL,
  rationale text,
  selections jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_count integer,
  cost numeric,
  estimated_coverage numeric,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_candidates_profile_valid CHECK (profile IN ('balanced', 'safer', 'value'))
);
GRANT SELECT, INSERT, UPDATE ON public.system_candidates TO authenticated;
GRANT ALL ON public.system_candidates TO service_role;
ALTER TABLE public.system_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select" ON public.system_candidates FOR SELECT TO authenticated USING (public.is_group_member(public.round_group_id(round_id)));
CREATE POLICY "sc_insert" ON public.system_candidates FOR INSERT TO authenticated WITH CHECK (public.is_group_member(public.round_group_id(round_id)));
CREATE POLICY "sc_update_responsible" ON public.system_candidates FOR UPDATE TO authenticated
  USING (public.is_round_responsible(round_id)) WITH CHECK (public.is_round_responsible(round_id));
CREATE TRIGGER system_candidates_updated_at BEFORE UPDATE ON public.system_candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Risk flags
CREATE TABLE public.risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.races(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type text NOT NULL DEFAULT 'risk',
  body text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT risk_flags_type_valid CHECK (flag_type IN ('risk', 'missing_info'))
);
GRANT SELECT, INSERT, UPDATE ON public.risk_flags TO authenticated;
GRANT ALL ON public.risk_flags TO service_role;
ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rf_select" ON public.risk_flags FOR SELECT TO authenticated USING (public.is_group_member(public.round_group_id(round_id)));
CREATE POLICY "rf_insert" ON public.risk_flags FOR INSERT TO authenticated WITH CHECK (public.is_group_member(public.round_group_id(round_id)) AND created_by = auth.uid());
CREATE POLICY "rf_update" ON public.risk_flags FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_round_responsible(round_id))
  WITH CHECK (public.is_group_member(public.round_group_id(round_id)));

-- Round automation/AI state
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS submitted_manually_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'not_started';

-- Assign next responsible member on round creation (rotation)
CREATE OR REPLACE FUNCTION public.assign_round_responsibility(_round_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _group_id uuid;
  _prev_user uuid;
  _next_user uuid;
BEGIN
  SELECT group_id INTO _group_id FROM public.rounds WHERE id = _round_id;
  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Omgången finns inte';
  END IF;
  IF NOT public.is_group_member(_group_id) THEN
    RAISE EXCEPTION 'Endast gruppens medlemmar kan tilldela spelansvar';
  END IF;

  SELECT rr.user_id INTO _prev_user
  FROM public.round_responsibility rr
  JOIN public.rounds r ON r.id = rr.round_id
  WHERE r.group_id = _group_id AND rr.round_id <> _round_id
  ORDER BY rr.assigned_at DESC
  LIMIT 1;

  SELECT user_id INTO _next_user FROM (
    SELECT rot.user_id, rot.position
    FROM public.responsibility_rotation rot
    WHERE rot.group_id = _group_id AND rot.active
    ORDER BY
      CASE WHEN _prev_user IS NULL THEN 0
           WHEN rot.position > COALESCE((SELECT position FROM public.responsibility_rotation WHERE group_id = _group_id AND user_id = _prev_user), -1) THEN 0
           ELSE 1 END,
      rot.position
  ) q LIMIT 1;

  IF _next_user IS NULL THEN
    SELECT user_id INTO _next_user FROM public.group_members WHERE group_id = _group_id ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.round_responsibility (round_id, user_id)
  VALUES (_round_id, _next_user)
  ON CONFLICT (round_id) DO NOTHING;

  INSERT INTO public.activity_log (group_id, round_id, user_id, event_type, description, after_value)
  VALUES (_group_id, _round_id, auth.uid(), 'responsibility_assigned', 'Veckans spelansvarig tilldelad', jsonb_build_object('user_id', _next_user));

  RETURN _next_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_round_responsibility(_round_id uuid, _new_user_id uuid, _reason text, _rotation_mode text DEFAULT 'continue')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _group_id uuid;
  _old_user uuid;
BEGIN
  SELECT group_id INTO _group_id FROM public.rounds WHERE id = _round_id;
  IF NOT public.is_group_member(_group_id) THEN
    RAISE EXCEPTION 'Saknar behörighet';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Orsak krävs vid byte av spelansvarig';
  END IF;

  SELECT user_id INTO _old_user FROM public.round_responsibility WHERE round_id = _round_id;

  UPDATE public.round_responsibility
  SET user_id = _new_user_id,
      replaced_user_id = _old_user,
      change_reason = _reason,
      rotation_mode = _rotation_mode,
      confirmed_at = NULL,
      assigned_at = now()
  WHERE round_id = _round_id;

  IF _rotation_mode = 'move_last' AND _old_user IS NOT NULL THEN
    UPDATE public.responsibility_rotation
    SET position = COALESCE((SELECT MAX(position) FROM public.responsibility_rotation WHERE group_id = _group_id), 0) + 1
    WHERE group_id = _group_id AND user_id = _old_user;
  END IF;

  INSERT INTO public.activity_log (group_id, round_id, user_id, event_type, description, before_value, after_value)
  VALUES (_group_id, _round_id, auth.uid(), 'responsibility_changed', _reason,
          jsonb_build_object('user_id', _old_user), jsonb_build_object('user_id', _new_user_id));
END;
$$;