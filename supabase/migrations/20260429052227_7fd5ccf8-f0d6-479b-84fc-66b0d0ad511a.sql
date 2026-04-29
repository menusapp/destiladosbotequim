
UPDATE restaurant_subscriptions
SET status = 'active',
    last_payment_at = now(),
    next_payment_at = (now() + interval '1 month'),
    failed_payments = 0,
    in_grace_period = false,
    grace_period_start = null,
    grace_period_ends_at = null
WHERE restaurant_id = '19f08165-f1d8-4aba-9ebe-d4fe364b84bb'
  AND status = 'pending_payment';

UPDATE restaurants
SET pending_plan_slug = null,
    trial_expired = false,
    trial_started_at = null,
    trial_ends_at = null
WHERE id = '19f08165-f1d8-4aba-9ebe-d4fe364b84bb';
