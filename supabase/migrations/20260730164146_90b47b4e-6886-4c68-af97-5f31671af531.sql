ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.round_responsibility
  ADD CONSTRAINT round_responsibility_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.responsibility_rotation
  ADD CONSTRAINT responsibility_rotation_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;