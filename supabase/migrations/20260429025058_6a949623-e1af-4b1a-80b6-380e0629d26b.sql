-- 1) Deduplicar: manter apenas a assinatura mais recente por restaurante
UPDATE restaurant_subscriptions
SET status = 'cancelled', updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT ON (restaurant_id) id
  FROM restaurant_subscriptions
  WHERE status IN ('active', 'past_due')
  ORDER BY restaurant_id, created_at DESC
)
AND status IN ('active', 'past_due');

-- 2) Índice único parcial — prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_subscriptions_one_active
ON restaurant_subscriptions (restaurant_id)
WHERE status IN ('active', 'past_due');