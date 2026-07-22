-- =====================================================================
-- SECURITY HARDENING — Parte 5: fecha a LEITURA anônima de PII (Estágio B)
-- ---------------------------------------------------------------------
-- ⚠️  APLICAR SOMENTE depois que os refactors de frontend do Estágio B
--     (leituras via RPC — ver runbook) estiverem em produção. Antes disso,
--     esta migration faria o cardápio parar de exibir pedido/cliente/etc.
--
-- Remove as políticas temporárias de SELECT anônimo (`zz_temp_anon_read*`)
-- das tabelas que o cliente toca. A partir daqui, o cliente lê seus próprios
-- dados apenas pelas RPCs SECURITY DEFINER da Parte 4 (escopadas + verificadas
-- por telefone). Isso encerra os achados "PII/pedidos/pagamentos legíveis por
-- anon".
--
-- As políticas de ESCRITA anônimas escopadas (INSERT de pedido, ocupação de
-- mesa, comanda, upsert de cliente, uso de cupom...) permanecem — são o
-- mínimo para o checkout funcionar e NÃO são `USING(true)`. Podem ser
-- migradas para RPCs num Estágio C futuro.
-- =====================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'zz_temp_anon_read%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;
