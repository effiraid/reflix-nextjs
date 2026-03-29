-- Per-user recent view history
CREATE TABLE public.user_view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, clip_id)
);

CREATE INDEX user_view_history_user_id_viewed_at_idx
  ON public.user_view_history (user_id, viewed_at DESC);

ALTER TABLE public.user_view_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own view history"
  ON public.user_view_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own view history"
  ON public.user_view_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own view history"
  ON public.user_view_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own view history"
  ON public.user_view_history FOR DELETE
  USING (auth.uid() = user_id);
