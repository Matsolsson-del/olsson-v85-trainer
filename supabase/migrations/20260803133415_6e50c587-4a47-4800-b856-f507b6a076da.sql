-- 1. Read-only for clients on service-written tables
REVOKE INSERT, UPDATE, DELETE ON
  public.ai_import_attempts,
  public.ai_import_settings,
  public.ai_import_versions,
  public.automation_runs,
  public.expert_tip_candidates,
  public.expert_tips,
  public.race_fact_changes,
  public.round_settlements
FROM anon, authenticated;

GRANT ALL ON
  public.ai_import_attempts,
  public.ai_import_settings,
  public.ai_import_versions,
  public.automation_runs,
  public.expert_tip_candidates,
  public.expert_tips,
  public.race_fact_changes,
  public.round_settlements,
  public.expert_tip_sources
TO service_role;

-- 2. expert_tip_sources: members may only toggle existing sources
REVOKE INSERT, DELETE ON public.expert_tip_sources FROM anon, authenticated;
REVOKE UPDATE ON public.expert_tip_sources FROM anon;
DROP POLICY IF EXISTS "Medlemmar kan andra kallor" ON public.expert_tip_sources;
CREATE POLICY "Medlemmar kan andra kallor"
ON public.expert_tip_sources FOR UPDATE TO authenticated
USING (public.is_group_member(group_id))
WITH CHECK (public.is_group_member(group_id));

-- 3. Reference tables: no more USING(true) write access
DROP POLICY IF EXISTS p_tracks_all ON public.tracks;
DROP POLICY IF EXISTS p_horses_all ON public.horses;
DROP POLICY IF EXISTS p_drivers_all ON public.drivers;
DROP POLICY IF EXISTS p_trainers_all ON public.trainers;

REVOKE DELETE ON public.tracks, public.horses, public.drivers, public.trainers FROM anon, authenticated;
REVOKE ALL ON public.tracks, public.horses, public.drivers, public.trainers FROM anon;
GRANT ALL ON public.tracks, public.horses, public.drivers, public.trainers TO service_role;

CREATE OR REPLACE FUNCTION public.is_any_group_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members m WHERE m.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_any_group_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_any_group_member() TO authenticated, service_role;

CREATE POLICY p_tracks_select ON public.tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY p_tracks_insert ON public.tracks FOR INSERT TO authenticated WITH CHECK (public.is_any_group_member());
CREATE POLICY p_tracks_update ON public.tracks FOR UPDATE TO authenticated USING (public.is_any_group_member()) WITH CHECK (public.is_any_group_member());

CREATE POLICY p_horses_select ON public.horses FOR SELECT TO authenticated USING (true);
CREATE POLICY p_horses_insert ON public.horses FOR INSERT TO authenticated WITH CHECK (public.is_any_group_member());
CREATE POLICY p_horses_update ON public.horses FOR UPDATE TO authenticated USING (public.is_any_group_member()) WITH CHECK (public.is_any_group_member());

CREATE POLICY p_drivers_select ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY p_drivers_insert ON public.drivers FOR INSERT TO authenticated WITH CHECK (public.is_any_group_member());
CREATE POLICY p_drivers_update ON public.drivers FOR UPDATE TO authenticated USING (public.is_any_group_member()) WITH CHECK (public.is_any_group_member());

CREATE POLICY p_trainers_select ON public.trainers FOR SELECT TO authenticated USING (true);
CREATE POLICY p_trainers_insert ON public.trainers FOR INSERT TO authenticated WITH CHECK (public.is_any_group_member());
CREATE POLICY p_trainers_update ON public.trainers FOR UPDATE TO authenticated USING (public.is_any_group_member()) WITH CHECK (public.is_any_group_member());

-- 4. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.assign_round_responsibility(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.change_round_responsibility(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_round_responsible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_family_group() FROM PUBLIC, anon, authenticated;

-- internal trigger functions must not be callable by clients
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_model_version() FROM PUBLIC, anon, authenticated;