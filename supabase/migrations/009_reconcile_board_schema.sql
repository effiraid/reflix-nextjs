-- Reconcile board storage after migration history drift.
--
-- Why this exists:
-- - remote migration history reports 005 as applied
-- - production data still uses boards.clip_ids and may be missing board_clips
-- - current app code expects board_clips and free-tier board insert limits
--
-- This migration is intentionally backward-compatible:
-- - keep boards.clip_ids for now
-- - create/fill board_clips
-- - make RPCs write to both storage shapes
-- - enforce free-tier board creation limit on INSERT

CREATE TABLE IF NOT EXISTS public.board_clips (
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (board_id, clip_id)
);

ALTER TABLE public.board_clips ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'board_clips'
      AND policyname = 'Users can manage own board clips'
  ) THEN
    CREATE POLICY "Users can manage own board clips"
      ON public.board_clips
      FOR ALL
      USING (
        board_id IN (
          SELECT id FROM public.boards WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'boards'
      AND column_name = 'clip_ids'
  ) THEN
    INSERT INTO public.board_clips (board_id, clip_id)
    SELECT b.id, unnest(b.clip_ids)
    FROM public.boards b
    WHERE array_length(b.clip_ids, 1) > 0
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.board_add_clip(p_board_id UUID, p_clip_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO public.board_clips (board_id, clip_id)
  VALUES (p_board_id, p_clip_id)
  ON CONFLICT DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'boards'
      AND column_name = 'clip_ids'
  ) THEN
    UPDATE public.boards
    SET clip_ids = CASE
      WHEN p_clip_id = ANY(COALESCE(clip_ids, '{}'::TEXT[]))
        THEN COALESCE(clip_ids, '{}'::TEXT[])
      ELSE array_append(COALESCE(clip_ids, '{}'::TEXT[]), p_clip_id)
    END
    WHERE id = p_board_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.board_remove_clip(p_board_id UUID, p_clip_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.board_clips
  WHERE board_id = p_board_id
    AND clip_id = p_clip_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'boards'
      AND column_name = 'clip_ids'
  ) THEN
    UPDATE public.boards
    SET clip_ids = array_remove(COALESCE(clip_ids, '{}'::TEXT[]), p_clip_id)
    WHERE id = p_board_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_board_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT tier FROM public.profiles WHERE id = NEW.user_id
  ) = 'free'
  AND (
    SELECT count(*) FROM public.boards WHERE user_id = NEW.user_id
  ) >= 1 THEN
    RAISE EXCEPTION 'Free tier limited to 1 board';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'boards_limit_check'
      AND tgrelid = 'public.boards'::regclass
  ) THEN
    CREATE TRIGGER boards_limit_check
      BEFORE INSERT ON public.boards
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_board_limit();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boards_name_length'
      AND conrelid = 'public.boards'::regclass
  ) THEN
    ALTER TABLE public.boards
      ADD CONSTRAINT boards_name_length CHECK (length(name) <= 50);
  END IF;
END $$;
