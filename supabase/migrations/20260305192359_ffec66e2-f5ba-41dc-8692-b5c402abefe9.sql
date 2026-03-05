
-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO and Dev can manage subscription_plans" ON public.subscription_plans
  FOR ALL USING (public.has_role(auth.uid(), 'ceo'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "Anyone can read active plans" ON public.subscription_plans
  FOR SELECT USING (true);

-- Create restaurant_subscriptions table
CREATE TABLE public.restaurant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_payment_at TIMESTAMP WITH TIME ZONE,
  next_payment_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.restaurant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO and Dev can manage subscriptions" ON public.restaurant_subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'ceo'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "Anon can read own subscription" ON public.restaurant_subscriptions
  FOR SELECT USING (true);

-- Create subscription_payments table
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.restaurant_subscriptions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  reference_month TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO and Dev can manage payments" ON public.subscription_payments
  FOR ALL USING (public.has_role(auth.uid(), 'ceo'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role));

-- Also allow dev role to manage app_versions
CREATE POLICY "Dev can manage versions" ON public.app_versions
  FOR ALL USING (public.has_role(auth.uid(), 'dev'::app_role));
