

# Plano de Correção de Segurança — 6 Erros

## Contexto arquitetural crítico

Este projeto **não usa Supabase Auth sessions** para o painel admin/CEO. Tudo roda como `anon` via localStorage. Isso significa que **não podemos usar `auth.uid()`** nas RLS policies. A estratégia é: **mover operações sensíveis para RPCs SECURITY DEFINER** e **restringir acesso direto às tabelas**.

---

## Erro 1: CEO credentials publicly readable/writable
**Tabela:** `ceo_users` — `USING(true)` para anon/authenticated

**Problema:** Qualquer pessoa pode ler usernames e password hashes dos CEOs.

**Solução:**
- Remover a policy `USING(true)` de `ceo_users`
- Criar policy restritiva: `SELECT` só retorna `id, username, display_name, is_active, created_at` (sem `password_hash`) — **mas RLS não filtra colunas**, então precisamos de RPCs
- Criar 3 RPCs SECURITY DEFINER:
  - `admin_list_ceo_users()` — retorna id, username, display_name, is_active, created_at (sem password_hash)
  - `admin_upsert_ceo_user(id, username, display_name, password_hash)` — cria/atualiza
  - `admin_delete_ceo_user(id)` — deleta (mantém mínimo 1)
- Bloquear acesso direto: `CREATE POLICY "block_all" ON ceo_users FOR ALL USING (false)`
- **Atualizar** `CEOCredentialsTab.tsx` para usar as RPCs em vez de queries diretas

**Risco de quebra:** Baixo. O login já usa RPC `validate_ceo_credentials`. Só o `CEOCredentialsTab` faz CRUD direto e será migrado.

---

## Erro 2 e 6: Fiscal certificates bucket sem scoping
**Bucket:** `fiscal-certificates` — policies permitem anon acessar qualquer arquivo

**Solução:**
- Remover `anon` das 4 policies (fiscal_select, fiscal_insert, fiscal_update, fiscal_delete)
- Manter apenas `authenticated` (para o caso de futura migração para auth real)
- **Mas** como o admin opera como `anon`, precisamos de outra abordagem:
  - Criar uma Edge Function `fiscal-storage-proxy` que valida `restaurant_id` via header e faz o upload/download server-side
  - **OU** manter anon mas adicionar path scoping: `(storage.foldername(name))[1]` deve ser um `restaurant_id` válido existente na tabela `restaurants`

**Abordagem escolhida:** Path scoping — restringir para que o path comece com um `restaurant_id` válido. Não é perfeito (qualquer anon que saiba um restaurant_id pode acessar), mas é significativamente melhor que acesso total e **não quebra nada**.

**Solução ideal futura:** Edge Function proxy (mais complexa, adiada para não quebrar fluxo fiscal existente).

**Risco de quebra:** Baixo se mantiver path scoping. O código já salva arquivos como `{restaurant_id}/certificate.pfx`.

---

## Erro 3: Password hashes expostos (restaurant_staff, restaurant_credentials)
**Tabelas:** `restaurant_staff`, `restaurant_credentials` — `USING(true)`

**Solução `restaurant_credentials`:**
- Nenhum código do frontend faz query direta nesta tabela (confirmado na busca)
- Login usa RPC `validate_restaurant_credentials` (SECURITY DEFINER)
- **Ação:** Trocar policy para `USING(false)` — bloquear acesso direto total
- O CEO dashboard não gerencia essa tabela diretamente (usa RPC de registro)

**Solução `restaurant_staff`:**
- `StaffLogin.tsx` faz 2 queries diretas:
  1. `select("id").eq("restaurant_id", ...)` — checa se tem staff (sem dados sensíveis)
  2. `insert(...)` — cria primeiro staff (admin owner)
- Login de staff usa RPC `validate_staff_credentials` (SECURITY DEFINER)
- **Ação:**
  - Criar RPC `admin_check_has_staff(p_restaurant_id)` — retorna boolean
  - Criar RPC `admin_create_first_staff(p_restaurant_id, display_name, username, password_hash, role, allowed_sections)` — insere apenas se não existir nenhum staff
  - Trocar policy para `USING(false)`
  - Atualizar `StaffLogin.tsx` para usar as RPCs

**Risco de quebra:** Médio. Precisa verificar se mais algum lugar do admin faz query direta em `restaurant_staff`. Vou verificar.

**⚠️ Alerta:** Se algum componente admin (ex: gestão de funcionários) faz CRUD direto em `restaurant_staff`, vai quebrar. Será necessário criar RPCs adicionais ou manter uma policy de SELECT que exclua `password_hash` (impossível via RLS — precisaria de view).

**Alternativa segura:** Criar uma VIEW `restaurant_staff_safe` que exclui `password_hash` e dar SELECT na view. Manter INSERT/UPDATE/DELETE via RPCs.

---

## Erro 4: Customer PII broadcast via Realtime
**Tabelas:** `customers`, `orders`, `comandas` no Realtime

**Problema:** Realtime broadcast PII (CPF, telefone, endereço) para qualquer subscriber.

**Realidade:** Remover do Realtime **quebraria** funcionalidades críticas:
- `TablesTab.tsx`, `PDVTab.tsx` — monitoram mesas e pedidos
- `UnifiedOrdersTab.tsx` — painel de pedidos em tempo real
- `RestaurantAdmin.tsx` — notificações de novos pedidos
- `OrderConfirmation.tsx` — cliente acompanha status
- `Comanda.tsx` — comanda digital

**Solução possível sem quebrar nada:**
- `customers` pode ser **removido do Realtime** — nenhum componente subscreve a changes de `customers` diretamente (confirmado: só `TablesTab` subscreve a `comandas`, `orders`, `tables`, `bills`)
- `orders` e `comandas` **não podem ser removidos** — são essenciais para o funcionamento

**Ação:**
- Remover `customers` da publicação Realtime
- Para `orders` e `comandas`: documentar como risco aceito (mitigável apenas com auth real futura)

**Risco de quebra:** Nenhum para `customers`. Seria catastrófico remover `orders` ou `comandas`.

---

## Erro 5: MercadoPago credentials em `online_payment_config`
**Tabela:** `online_payment_config` — `USING(true)`, contém `mp_access_token`, `mp_refresh_token`

**Problema:** Qualquer pessoa pode ler tokens de produção do MercadoPago.

**Solução:**
- O menu digital (anon) precisa ler apenas: `enabled`, `accept_pix`, `accept_card`, `enable_for_delivery`, `connection_status`, `mp_public_key`
- O admin (anon com restaurant_id em localStorage) precisa de CRUD completo
- **Ação:**
  - Criar VIEW `online_payment_config_public` com apenas as colunas seguras
  - Criar RPC `admin_get_payment_config(p_restaurant_id)` — retorna tudo (para o admin)
  - Criar RPC `admin_update_payment_config(p_restaurant_id, ...)` — atualiza
  - Criar RPC `admin_delete_payment_config(p_restaurant_id)` — deleta
  - Trocar policy da tabela original para `USING(false)`
  - Atualizar `PaymentStep.tsx` e `OnlinePaymentStep.tsx` para usar a VIEW
  - Atualizar `OnlinePaymentsSettings.tsx` para usar as RPCs

**Risco de quebra:** Médio. O `mercadopago-charge` Edge Function acessa `mp_access_token` server-side via service_role — isso **não é afetado** por RLS. A Edge Function `mercadopago-oauth` também acessa server-side. Seguro.

---

## Erro extra: Hardcoded CEO credentials
**Arquivo:** `RestaurantLogin.tsx` linha 41 — `CEO` / `CEO123`

**Ação:** Remover o fallback hardcoded. O login CEO agora usa a tabela `ceo_users` + RPC.

---

## Resumo de arquivos a alterar

| Arquivo | Mudança |
|---|---|
| Migration SQL | Novas RPCs, policies, view |
| `src/components/ceo/CEOCredentialsTab.tsx` | Usar RPCs |
| `src/pages/StaffLogin.tsx` | Usar RPCs |
| `src/pages/RestaurantLogin.tsx` | Remover fallback CEO hardcoded |
| `src/components/admin/settings/OnlinePaymentsSettings.tsx` | Usar RPCs |
| `src/components/menu/checkout/PaymentStep.tsx` | Usar view |
| `src/components/menu/checkout/OnlinePaymentStep.tsx` | Usar RPC/view para mp_public_key |

## O que NÃO será alterado
- Fluxo de pedidos, estoque, fiscal, impressão
- Edge Functions existentes (acessam via service_role)
- Realtime de `orders` e `comandas` (risco documentado)
- Integrações iFood, DD, WhatsApp

## Ordem de execução
1. Migration: criar RPCs, views, trocar policies
2. Atualizar código frontend
3. Remover CEO hardcoded

