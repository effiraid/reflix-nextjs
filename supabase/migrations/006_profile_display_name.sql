-- Add display_name to profiles for account settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
