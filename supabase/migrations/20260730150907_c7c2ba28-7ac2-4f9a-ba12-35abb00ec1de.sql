
-- ENUMS
CREATE TYPE public.group_role AS ENUM ('owner','member');
CREATE TYPE public.round_status AS ENUM ('draft','individual_analysis','analyses_revealed','group_assessment','system_building','system_locked','results_registered','postmortem','completed');
CREATE TYPE public.tier AS ENUM ('A','B','C','D');
CREATE TYPE public.include_preference AS ENUM ('must_include','consider','exclude','neutral');
CREATE TYPE public.start_method AS ENUM ('auto','volt');
CREATE TYPE public.system_status AS ENUM ('draft','final');
CREATE TYPE public.assessment_status AS ENUM ('draft','locked');
CREATE TYPE public.driver_execution AS ENUM ('better','as_expected','worse','not_assessed');
CREATE TYPE public.error_category AS ENUM ('capacity_error','form_error','position_or_pace_error','distance_or_start_method_error','driver_underestimated','driver_overestimated','driver_horse_combo_underestimated','current_information_missed','system_construction_error','excessive_value_hunting','excessive_favorite_protection','unpredictable_event');
CREATE TYPE public.transaction_type AS ENUM ('contribution','stake','winnings','withdrawal','correction');

-- UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- IDENTITY
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_row_price numeric(6,2) NOT NULL DEFAULT 0.50,
  default_budget numeric(10,2) NOT NULL DEFAULT 450.00,
  settings jsonb NOT NULL DEFAULT '{"spike_min_probability":45,"deselected_min_probability":12,"max_offensive_spikes":1,"low_coverage_threshold":70}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_role NOT NULL DEFAULT 'member',
  share_percent numeric(5,2) NOT NULL DEFAULT 33.33,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- HELPERS
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = _group_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = _group_id AND m.user_id = auth.uid() AND m.role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Owner blir automatiskt medlem
CREATE OR REPLACE FUNCTION public.handle_new_group() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_group_created AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- GRUNDDATA
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(name)) STORED,
  short_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.horses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(name)) STORED,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(name)) STORED,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(name)) STORED,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  version text NOT NULL,
  title text NOT NULL,
  valid_from date NOT NULL DEFAULT current_date,
  assessment_principles text,
  spike_rules text,
  driver_assessment text,
  value_vs_probability text,
  hypothesis text,
  next_change_requirement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Standardmetod per ny grupp
CREATE OR REPLACE FUNCTION public.seed_default_model_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.model_versions (group_id, version, title, assessment_principles, spike_rules, driver_assessment, value_vs_probability, hypothesis, next_change_requirement)
  VALUES (NEW.id, '1.0', 'Metod 1.0 – disciplin före magkänsla',
   E'- Minst en spik ska vara ett robust säkerhetsankare\n- Låg streckprocent är inte i sig ett argument för val\n- Externa expertrankningar är datapunkter och inte facit\n- Högt bedömd bortvald häst kräver motivering\n- Radantal och kostnad ska alltid verifieras',
   E'- Normalt högst en spik får vara ett offensivt värdeval\n- Spik under 45 procent kräver särskild motivering',
   E'- En välkänd kusk är inte automatiskt ett plus om ekipaget saknar dokumenterad historik\n- Ordinarie kusk med bevisad hästkännedom får inte nedvärderas enbart på grund av lägre nationell profil\n- Kuskens betydelse höjs i kortlopp, voltstart och taktiskt känsliga lopp',
   'Prestationsbedömning, marknadsbedömning och systembeslut hålls åtskilda.',
   'Disciplinerad systemkonstruktion ger bättre träffbild än magkänsla.',
   'Metodändring får inte göras efter ett enda utfall.');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_group_created_model AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.seed_default_model_version();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_profiles_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY p_profiles_group ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.group_members a JOIN public.group_members b ON a.group_id = b.group_id
          WHERE a.user_id = auth.uid() AND b.user_id = profiles.id));
CREATE POLICY p_profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY p_groups_select ON public.groups FOR SELECT TO authenticated USING (public.is_group_member(id) OR owner_id = auth.uid());
CREATE POLICY p_groups_insert ON public.groups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY p_groups_update ON public.groups FOR UPDATE TO authenticated USING (public.is_group_owner(id)) WITH CHECK (public.is_group_owner(id));
CREATE POLICY p_groups_delete ON public.groups FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY p_gm_select ON public.group_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_group_member(group_id));
CREATE POLICY p_gm_insert ON public.group_members FOR INSERT TO authenticated WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY p_gm_update ON public.group_members FOR UPDATE TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY p_gm_delete ON public.group_members FOR DELETE TO authenticated USING (public.is_group_owner(group_id));

CREATE POLICY p_inv_select ON public.group_invitations FOR SELECT TO authenticated USING (
  public.is_group_member(group_id) OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'),'')));
CREATE POLICY p_inv_insert ON public.group_invitations FOR INSERT TO authenticated WITH CHECK (public.is_group_owner(group_id) AND invited_by = auth.uid());
CREATE POLICY p_inv_delete ON public.group_invitations FOR DELETE TO authenticated USING (public.is_group_owner(group_id));

CREATE POLICY p_tracks_all ON public.tracks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_horses_all ON public.horses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_drivers_all ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_trainers_all ON public.trainers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY p_mv_select ON public.model_versions FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY p_mv_write ON public.model_versions FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id));
CREATE POLICY p_mv_update ON public.model_versions FOR UPDATE TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));

-- GRANTS
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;
END $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_groups_upd BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_mv_upd BEFORE UPDATE ON public.model_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
