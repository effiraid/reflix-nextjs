-- Index for boards listing by user (10K+ scale)
CREATE INDEX IF NOT EXISTS boards_user_id_idx
  ON public.boards (user_id);

-- Index for subscriptions lookup by user
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx
  ON public.subscriptions (user_id);
