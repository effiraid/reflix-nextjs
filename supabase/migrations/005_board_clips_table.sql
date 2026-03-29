-- board_clips join table: replaces boards.clip_ids TEXT[] with a proper M:N relation.
-- Eliminates race conditions and scales better for large boards.

-- 1. board_clips join table
CREATE TABLE public.board_clips (
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (board_id, clip_id)
);
ALTER TABLE public.board_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own board clips"
  ON public.board_clips FOR ALL
  USING (board_id IN (SELECT id FROM public.boards WHERE user_id = auth.uid()));

-- 2. Migrate existing clip_ids data
INSERT INTO public.board_clips (board_id, clip_id)
SELECT b.id, unnest(b.clip_ids) FROM public.boards b
WHERE array_length(b.clip_ids, 1) > 0
ON CONFLICT DO NOTHING;

-- 3. Drop clip_ids column from boards
ALTER TABLE public.boards DROP COLUMN clip_ids;

-- 4. board_add_clip / board_remove_clip RPC (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.board_add_clip(p_board_id UUID, p_clip_id TEXT)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  INSERT INTO public.board_clips (board_id, clip_id)
  VALUES (p_board_id, p_clip_id)
  ON CONFLICT DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.board_remove_clip(p_board_id UUID, p_clip_id TEXT)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  DELETE FROM public.board_clips
  WHERE board_id = p_board_id AND clip_id = p_clip_id;
$$;

-- 5. Free tier board limit trigger
CREATE OR REPLACE FUNCTION public.enforce_board_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT tier FROM public.profiles WHERE id = NEW.user_id) = 'free'
     AND (SELECT count(*) FROM public.boards WHERE user_id = NEW.user_id) >= 1
  THEN RAISE EXCEPTION 'Free tier limited to 1 board';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER boards_limit_check BEFORE INSERT ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_board_limit();

-- 6. Board name length constraint
ALTER TABLE public.boards ADD CONSTRAINT boards_name_length CHECK (length(name) <= 50);
