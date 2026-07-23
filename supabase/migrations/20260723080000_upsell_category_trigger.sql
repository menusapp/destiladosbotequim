-- =====================================================================
-- UPSELL: gatilho por CATEGORIA (além de por produto específico)
-- ---------------------------------------------------------------------
-- Requisito: a oferta da sacola pode ser disparada por (a) um produto
-- específico OU (b) QUALQUER produto de uma categoria. Antes só existia (a).
-- Adiciona trigger_type + trigger_category_id, torna trigger_product_id
-- opcional e ajusta as constraints/uniques.
-- =====================================================================

ALTER TABLE public.product_upsells
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS trigger_category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

-- trigger_product_id passa a ser opcional (gatilho por categoria não usa)
ALTER TABLE public.product_upsells ALTER COLUMN trigger_product_id DROP NOT NULL;

-- Remove a UNIQUE(trigger_product_id, upsell_product_id) e a
-- CHECK(trigger_product_id <> upsell_product_id) originais (assumiam produto).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.product_upsells'::regclass
  LOOP
    IF r.def ILIKE '%trigger_product_id%'
       AND (upper(r.def) LIKE 'UNIQUE%' OR r.def LIKE '%<>%') THEN
      EXECUTE format('ALTER TABLE public.product_upsells DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

-- Novas regras de integridade
ALTER TABLE public.product_upsells
  ADD CONSTRAINT product_upsells_trigger_type_chk
    CHECK (trigger_type IN ('product','category')),
  ADD CONSTRAINT product_upsells_trigger_oneof_chk
    CHECK (
      (trigger_type = 'product'  AND trigger_product_id IS NOT NULL AND trigger_category_id IS NULL)
      OR (trigger_type = 'category' AND trigger_category_id IS NOT NULL AND trigger_product_id IS NULL)
    ),
  ADD CONSTRAINT product_upsells_not_self_chk
    CHECK (trigger_product_id IS NULL OR trigger_product_id <> upsell_product_id);

-- Uniques por tipo (evita regra duplicada)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_upsell_product_trigger
  ON public.product_upsells (trigger_product_id, upsell_product_id)
  WHERE trigger_type = 'product';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_upsell_category_trigger
  ON public.product_upsells (trigger_category_id, upsell_product_id)
  WHERE trigger_type = 'category';

CREATE INDEX IF NOT EXISTS idx_product_upsells_trigger_cat
  ON public.product_upsells (trigger_category_id) WHERE is_active;

-- Consistência com o modelo de sessão por token: o staff escreve como `anon`
-- (identidade via x-app-token). A RLS (staff_all, TO public + current_restaurant_id)
-- é o porteiro; garantimos os privilégios de tabela para anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_upsells TO anon, authenticated;
