
-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Clean up duplicate customer_sessions, keeping only the most recent per token+restaurant
DELETE FROM customer_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (session_token, restaurant_id) id
  FROM customer_sessions
  ORDER BY session_token, restaurant_id, last_activity DESC NULLS LAST, created_at DESC NULLS LAST
);

-- Add unique constraint
ALTER TABLE customer_sessions
  ADD CONSTRAINT customer_sessions_token_restaurant_unique UNIQUE (session_token, restaurant_id);
