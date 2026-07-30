DELETE FROM public.groups WHERE id = 'b73088b1-1aec-4b83-b4fb-e6b39ac2d982';

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_group_user_unique UNIQUE (group_id, user_id);