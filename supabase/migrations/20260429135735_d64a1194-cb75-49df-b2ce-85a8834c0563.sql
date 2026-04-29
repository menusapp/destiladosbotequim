ALTER TABLE public.subscription_plans REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_subscriptions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_subscriptions;