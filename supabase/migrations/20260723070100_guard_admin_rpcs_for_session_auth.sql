-- =====================================================================
-- FIX: RPCs admin_* passam a exigir sessão de staff/ceo (modelo por token)
-- ---------------------------------------------------------------------
-- As funções admin_* são SECURITY DEFINER e confiavam apenas no papel
-- `authenticated` como porteiro (o corpo só valida que a entidade pertence
-- ao p_restaurant_id informado — que o chamador fornece). No modelo de
-- sessão por token o staff é `anon`, então essas funções ficaram inacessíveis
-- ("permission denied"). Simplesmente liberar para anon seria uma falha —
-- qualquer anônimo poderia deletar produtos/pedidos informando o restaurant_id
-- (que é público).
--
-- Solução: para cada função, renomeamos a original para *_secured_impl_<oid>
-- e criamos um WRAPPER com o nome/assinatura originais que:
--   1) exige `is_staff() OR is_ceo()` (anon sem token → nega);
--   2) delega para a implementação original.
-- O wrapper é liberado para anon/authenticated; a impl fica fora do alcance
-- de anon. Tudo roda em transação: se algo falhar, faz rollback limpo.
-- =====================================================================
DO $outer$
DECLARE
  r record;
  v_impl text;
  v_callargs text;
  v_body text;
  fns text[] := ARRAY[
    'admin_update_order_status','admin_cancel_order_item','admin_delete_order',
    'admin_delete_category','admin_delete_product','admin_delete_stock_item',
    'admin_list_staff','admin_upsert_staff','admin_create_staff','admin_delete_staff',
    'admin_toggle_staff_active','admin_get_whatsapp_status','admin_get_point_terminals',
    'admin_upsert_point_terminal','admin_delete_point_terminal','check_mp_token_expiry',
    'restore_stock_for_order_item','admin_delete_bill','admin_delete_bill_and_orders',
    'admin_delete_order_and_bill','admin_delete_product_extra','admin_mark_bill_on_the_way',
    'admin_mark_bill_paid','admin_update_restaurant_settings','admin_delete_payment_config',
    'admin_get_payment_config','admin_upsert_payment_config','admin_ensure_payment_config',
    'admin_get_ifood_config','admin_toggle_ifood','admin_toggle_dd','admin_get_dd_config'
  ];
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           p.pronargs,
           p.proretset,
           (p.prorettype = 'void'::regtype) AS is_void,
           pg_get_function_arguments(p.oid)          AS args,       -- com defaults (assinatura do wrapper)
           pg_get_function_identity_arguments(p.oid) AS idargs,     -- identidade (para RENAME/GRANT)
           pg_get_function_result(p.oid)             AS result,
           pg_get_functiondef(p.oid)                 AS def,
           COALESCE(p.proargmodes, '{}')             AS argmodes
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY(fns)
  LOOP
    -- Processa cada função isoladamente: um erro numa não aborta as demais.
    BEGIN
      -- Pula funções com OUT/INOUT/VARIADIC (assinatura complexa): apenas
      -- garante o grant (não há como envolver com segurança de forma genérica).
      IF r.argmodes && ARRAY['o','b','v']::"char"[] THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.idargs);
        CONTINUE;
      END IF;

      -- Idempotência: se a função já tem guarda de sessão, só garante o grant.
      IF r.def ILIKE '%is_staff()%' OR r.def ILIKE '%is_ceo()%' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated', r.proname, r.idargs);
        CONTINUE;
      END IF;

      v_impl := r.proname || '_secured_impl_' || r.oid::text;

      -- argumentos posicionais $1..$n para repassar à impl
      SELECT string_agg('$' || g, ', ') INTO v_callargs
      FROM generate_series(1, GREATEST(r.pronargs, 0)) g;
      v_callargs := COALESCE(v_callargs, '');

      -- renomeia a original -> impl
      EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', r.proname, r.idargs, v_impl);

      -- corpo do wrapper conforme o tipo de retorno
      IF r.is_void THEN
        v_body := format(
          'BEGIN IF NOT (public.is_staff() OR public.is_ceo()) THEN RAISE EXCEPTION %L USING ERRCODE = %L; END IF; PERFORM public.%I(%s); END;',
          'Acesso negado: sessao de staff necessaria', '42501', v_impl, v_callargs);
      ELSIF r.proretset THEN
        v_body := format(
          'BEGIN IF NOT (public.is_staff() OR public.is_ceo()) THEN RAISE EXCEPTION %L USING ERRCODE = %L; END IF; RETURN QUERY SELECT * FROM public.%I(%s); END;',
          'Acesso negado: sessao de staff necessaria', '42501', v_impl, v_callargs);
      ELSE
        v_body := format(
          'BEGIN IF NOT (public.is_staff() OR public.is_ceo()) THEN RAISE EXCEPTION %L USING ERRCODE = %L; END IF; RETURN public.%I(%s); END;',
          'Acesso negado: sessao de staff necessaria', '42501', v_impl, v_callargs);
      END IF;

      -- cria o wrapper com o nome/assinatura originais
      EXECUTE format(
        'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $w$ %s $w$',
        r.proname, r.args, r.result, v_body);

      -- grants: wrapper acessível ao staff (anon+token); impl fora do alcance de anon
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated', r.proname, r.idargs);
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon, public', v_impl, r.idargs);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'guard_admin_rpcs: falhou em % (%): %', r.proname, r.idargs, SQLERRM;
    END;
  END LOOP;
END $outer$;
