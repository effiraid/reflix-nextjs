-- Stripe operational security guards
-- 1. Persist processed webhook event IDs to skip duplicate deliveries safely.
-- 2. Track checkout session creation attempts for authenticated user rate limiting.

CREATE TABLE public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  object_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('processed', 'failed')),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX stripe_webhook_events_created_at_idx
  ON public.stripe_webhook_events (created_at DESC);

CREATE TRIGGER stripe_webhook_events_updated_at
  BEFORE UPDATE ON public.stripe_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.checkout_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('checkout_session')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX checkout_rate_limits_lookup_idx
  ON public.checkout_rate_limits (user_id, action, created_at DESC);
