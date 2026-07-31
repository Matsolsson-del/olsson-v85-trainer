ALTER TABLE public.imported_history_rounds
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.imported_history_rounds(id);

ALTER TABLE public.imported_history_rounds
  DROP CONSTRAINT IF EXISTS imported_history_rounds_review_status_check;

ALTER TABLE public.imported_history_rounds
  ADD CONSTRAINT imported_history_rounds_review_status_check
  CHECK (review_status IN ('unreviewed','active','separate','superseded','archived'));

CREATE INDEX IF NOT EXISTS imported_history_rounds_dupe_idx
  ON public.imported_history_rounds (group_id, track_name, race_date);

UPDATE public.imported_history_rounds h
SET review_status = 'active'
WHERE h.review_status = 'unreviewed'
  AND NOT EXISTS (
    SELECT 1 FROM public.imported_history_rounds o
    WHERE o.group_id = h.group_id
      AND o.race_date = h.race_date
      AND coalesce(o.track_name,'') = coalesce(h.track_name,'')
      AND o.id <> h.id
  );