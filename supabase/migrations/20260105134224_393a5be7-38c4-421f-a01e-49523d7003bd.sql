-- Delete orphan redemptions (recorded without completing order)
DELETE FROM loyalty_reward_redemptions 
WHERE order_id IS NULL;