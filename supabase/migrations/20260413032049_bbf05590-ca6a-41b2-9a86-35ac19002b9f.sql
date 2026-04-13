
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expired boolean DEFAULT false;

ALTER TABLE public.restaurant_subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false;
