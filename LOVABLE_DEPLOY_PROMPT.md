# Prompt para o Lovable — aplicar a correção de segurança

Cole o texto abaixo no chat do Lovable. Ele executa a parte do Supabase (migrations,
secret, edge function) na ordem segura. Está dividido em **Fase 1 (segura, faça primeiro)**
e **Fase 2 (só depois da Fase 1 testada)**.

---

## 📋 Prompt (copie a partir daqui)

Fizemos uma correção de segurança grande neste projeto (já está no código, no GitHub).
O objetivo é fechar os alertas de RLS/PII sem quebrar nada. **Siga exatamente esta ordem
e NÃO pule para a Fase 2 antes da Fase 1 estar testada e funcionando.**

Contexto técnico: o app não tinha autenticação real (login era só RPC + localStorage, tudo
rodava como `anon`). Agora existe uma edge function `issue-session-token` que emite um JWT
assinado no login; o `src/integrations/supabase/client.ts` anexa esse token como
`Authorization: Bearer`, então o painel passa a operar como `authenticated` e o RLS consegue
proteger os dados. **Não reverta nem "simplifique" a lógica do token no `client.ts`,
`authSession.ts` e nas telas de login — é intencional.**

### FASE 1 — Estágio A (seguro)

1. **Secret de assinatura do token.** Pegue o **JWT Secret** do projeto em
   Project Settings → API → JWT Keys (o segredo HS256 "legacy") e crie um secret da
   edge function chamado `JWT_SECRET` com esse valor.
   - Se o projeto tiver desativado o segredo HS256 legacy (usa só chaves assimétricas),
     **reative o legacy JWT secret**, senão o login não valida o token.

2. **Edge function.** Garanta que `supabase/functions/issue-session-token` está **deployada**
   e com **Verify JWT DESLIGADO** (é um endpoint de login, chamado antes de existir sessão —
   já está em `supabase/config.toml` como `verify_jwt = false`).

3. **Migrations — aplique NESTA ORDEM, e NÃO aplique a de número 5 ainda:**
   - `supabase/migrations/20260722100000_security_1_helpers_and_schema.sql`
   - `supabase/migrations/20260722100100_security_2_rls_policies.sql`
   - `supabase/migrations/20260722100200_security_3_storage_and_grants.sql`
   - `supabase/migrations/20260722100300_security_4_customer_rpcs.sql`
   - ⛔ **NÃO** aplique ainda: `...20260722100400_security_5_close_anon_reads.sql`

4. **Teste no preview:**
   - Fazer login de restaurante → funcionário → o painel abre e **mostra dados**
     (pedidos, caixa). Se aparecem dados, o token está sendo aceito ✅.
     Se der erro de permissão/JWT, o problema é o `JWT_SECRET` (passo 1).
   - Abrir o cardápio público, montar carrinho e **fazer um pedido** — deve funcionar.
   - PDV: abrir/fechar caixa, criar pedido, imprimir.

Observações:
- É um estabelecimento único: o RLS usa `default_restaurant_id()` = o restaurante mais
  antigo. Confirme que é o "Destilado Botequim".
- Se alguma migration falhar por uma tabela/função que não existe no banco, me avise
  o nome — provavelmente é algo criado só no banco ao vivo.

### FASE 2 — Estágio B (só depois da Fase 1 OK)

Objetivo: fechar a **leitura anônima de dados de cliente** (nomes, CPF, pedidos, endereços,
cartões, pagamentos). As RPCs seguras já existem (foram criadas na migration 4). Falta trocar
as leituras diretas do frontend por essas RPCs e então aplicar a migration 5.

5. **Refatore SOMENTE as LEITURAS abaixo** (não mexa nas escritas/insert de pedido, ocupação
   de mesa, comanda, cupom, criação de cliente/endereço — elas continuam como estão):

   | Arquivo | Trocar leitura direta por RPC |
   |---|---|
   | `OrderConfirmation.tsx` | `get_order_details(id)` + polling `get_order_status(id)` no lugar do realtime em `orders` |
   | `menu/PedidosHistory.tsx` | `get_customer_orders(cpf, phone)` (polling no lugar do realtime) |
   | `menu/ProfileView.tsx` | `get_customer_by_cpf`, `get_customer_orders`, `list_customer_addresses`, `get_customer_coupons` |
   | `menu/CustomerInfoDialog.tsx`, `kiosk/KioskPhoneCollection.tsx`, `kiosk/KioskIdentification.tsx` | `get_customer_by_cpf(cpf)` |
   | `checkout/AddressStep.tsx`, `kiosk/KioskDeliveryAddress.tsx` | `list_customer_addresses(cpf, phone)` |
   | `checkout/PaymentStep.tsx` | `get_customer_by_cpf(cpf)` |
   | `checkout/CouponInput.tsx`, `kiosk/KioskCart.tsx` | `validate_coupon(code)` |
   | `checkout/OnlinePaymentStep.tsx` | `get_payment_status(id)`, `get_saved_cards(cpf, phone)`, `delete_saved_card(id, cpf)` |
   | `checkout/LoyaltyPointsDisplay.tsx`, `CheckoutDrawer.tsx` (leitura de saldo) | `get_loyalty_balance(cpf)` |
   | `checkout/LoyaltyRewardNotification.tsx` | `get_customer_coupons(cpf)`, `validate_coupon(code)` |
   | `Menu.tsx`, `Comanda.tsx` (comanda de mesa) | polling `get_comanda_status(table_id, cpf)` no lugar do realtime em `comandas`/`bills` |
   | `DeliveryMenu.tsx`, `Kiosk.tsx`, `KioskConfirmation.tsx` | `get_customer_by_cpf`, `get_order_details` |
   | `Reservations.tsx`, `menu/ReservationsView.tsx` (leitura) | `get_reservation_availability(date)`, `get_my_reservations(cpf, phone)` |

   Regras: (a) chame as RPCs com `(supabase as any).rpc('nome', { p_... })`; (b) onde hoje há
   `realtime`/`postgres_changes` em tabela de cliente, troque por **polling** da RPC (ex.: a
   cada 15s), pois o realtime dependia do SELECT anônimo que será removido; (c) `get_order_details`
   retorna o pedido + itens + extras em um único objeto JSON.

6. **Teste o fluxo completo do cliente no preview** (pedido, confirmação e status ao vivo,
   histórico, endereços, cupom, fidelidade, reserva, comanda de mesa).

7. **Só então aplique** `supabase/migrations/20260722100400_security_5_close_anon_reads.sql`.

8. **Reteste** o fluxo do cliente. Confirme que, com a chave pública, um
   `select * from customers` já **não** retorna linhas.

### Depois de tudo
- Rotacione a chave publishable (a antiga funcionou como acesso total por muito tempo).
- Rode o scan de segurança de novo — os alertas de RLS aberto e de funções `SECURITY DEFINER`
  públicas devem estar zerados.

---

_Detalhes completos em `SECURITY_HARDENING_RUNBOOK.md`._
