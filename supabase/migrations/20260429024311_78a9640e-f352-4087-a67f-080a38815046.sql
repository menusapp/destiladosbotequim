-- Adiciona controle de inadimplência e transição de plano em restaurant_subscriptions
ALTER TABLE public.restaurant_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_grace_period boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_downgrade_plan_id uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS pending_downgrade_at date,
  ADD COLUMN IF NOT EXISTS pending_upgrade_plan_id uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS current_period_start date,
  ADD COLUMN IF NOT EXISTS current_period_end date;

-- Tabela de links de assinatura por plano (configurados no painel CEO)
CREATE TABLE IF NOT EXISTS public.plan_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  mp_subscription_link text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id)
);

ALTER TABLE public.plan_payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active plan links" ON public.plan_payment_links;
CREATE POLICY "Anyone can read active plan links"
  ON public.plan_payment_links
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "CEO and Dev can manage plan links" ON public.plan_payment_links;
CREATE POLICY "CEO and Dev can manage plan links"
  ON public.plan_payment_links
  FOR ALL
  USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'dev'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'dev'::app_role));

-- Permite anon gerenciar (painel CEO usa anon + auth próprio)
DROP POLICY IF EXISTS "Allow anon to manage plan links" ON public.plan_payment_links;
CREATE POLICY "Allow anon to manage plan links"
  ON public.plan_payment_links
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_plan_payment_links_plan_id ON public.plan_payment_links(plan_id);
CREATE INDEX IF NOT EXISTS idx_rsubs_grace_ends ON public.restaurant_subscriptions(grace_period_ends_at) WHERE in_grace_period = true;
CREATE INDEX IF NOT EXISTS idx_rsubs_pending_downgrade ON public.restaurant_subscriptions(pending_downgrade_at) WHERE pending_downgrade_plan_id IS NOT NULL;