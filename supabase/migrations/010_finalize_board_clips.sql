-- Finalize board_clips as the only source of truth for board membership.
--
-- Safety notes:
-- - 009_reconcile_board_schema.sql already created/backfilled board_clips.
-- - Production is now running a deployment that reads board_clips-based board data.
-- - This migration removes the legacy boards.clip_ids column and stops dual writes.

INSERT INTO public.board_clips (board_id, clip_id)
SELECT b.id, unnest(b.clip_ids)
FROM public.boards b
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'boards'
    AND column_name = 'clip_ids'
)
  AND array_length(b.clip_ids, 1) > 0
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.board_add_clip(p_board_id UUID, p_clip_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.board_clips (board_id, clip_id)
  VALUES (p_board_id, p_clip_id)
  ON CONFLICT DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.board_remove_clip(p_board_id UUID, p_clip_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  DELETE FROM public.board_clips
  WHERE board_id = p_board_id
    AND clip_id = p_clip_id;
$$;

ALTER TABLE public.boards
  DROP COLUMN IF EXISTS clip_ids;
