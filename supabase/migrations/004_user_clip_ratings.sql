-- User clip ratings & memos (personal, replaces Eagle star/annotation)
CREATE TABLE public.user_clip_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, clip_id)
);

-- Fast lookup by user
CREATE INDEX user_clip_ratings_user_id_idx
  ON public.user_clip_ratings (user_id);

-- Trigger: auto-update updated_at
CREATE TRIGGER user_clip_ratings_updated_at
  BEFORE UPDATE ON public.user_clip_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.user_clip_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ratings"
  ON public.user_clip_ratings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ratings"
  ON public.user_clip_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON public.user_clip_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
  ON public.user_clip_ratings FOR DELETE
  USING (auth.uid() = user_id);
