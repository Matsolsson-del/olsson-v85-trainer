ALTER TABLE public.system_candidates DROP CONSTRAINT IF EXISTS system_candidates_profile_valid;
ALTER TABLE public.system_candidates ADD CONSTRAINT system_candidates_profile_valid
  CHECK (profile = ANY (ARRAY['balanced','safer','value','balanserat','sakrare','tryggt','varde','offensivt']));