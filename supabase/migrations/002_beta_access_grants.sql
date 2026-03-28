CREATE TABLE public.beta_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual', 'invite', 'campaign')),
  campaign_key TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  note TEXT,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX beta_access_grants_user_id_idx
  ON public.beta_access_grants (user_id);

CREATE INDEX beta_access_grants_active_window_idx
  ON public.beta_access_grants (user_id, starts_at, ends_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.beta_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own beta access grants"
  ON public.beta_access_grants
  FOR SELECT
  USING (auth.uid() = user_id);
