-- Add reward_extra_id column to support specific product variations for free item rewards
ALTER TABLE public.loyalty_program_rewards
ADD COLUMN reward_extra_id uuid REFERENCES public.product_extras(id) ON DELETE SET NULL;