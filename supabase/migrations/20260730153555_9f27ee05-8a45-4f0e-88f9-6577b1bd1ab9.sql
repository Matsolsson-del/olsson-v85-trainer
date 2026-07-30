CREATE OR REPLACE FUNCTION public.join_family_group()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _group_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT gm.group_id INTO _group_id
  FROM public.group_members gm
  WHERE gm.user_id = _uid
  ORDER BY gm.created_at
  LIMIT 1;

  IF _group_id IS NOT NULL THEN
    RETURN _group_id;
  END IF;

  SELECT g.id INTO _group_id
  FROM public.groups g
  ORDER BY g.created_at
  LIMIT 1;

  IF _group_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role, share_percent)
  VALUES (_group_id, _uid, 'member', 0)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN _group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_family_group() TO authenticated;