

# Correção da Integração Mercado Pago

## Problemas identificados

### Problema 1 — Pagamentos online não aparecem no cardápio
O `PaymentStep.tsx` (linha 120-124) faz query direta em `online_payment_config` para verificar se pagamentos online estão habilitados. A tabela tem `block_direct_access` RLS, então retorna vazio — o cardápio nunca mostra as opções de Pix/Cartão online.

O `OnlinePaymentStep.tsx` (linhas 133-137 e 374-378) também faz queries diretas para buscar `mp_public_key` — bloqueadas pela mesma RLS.

### Problema 2 — OAuth pode não estar redirecionando corretamente
O fluxo reportado ("conectou sem ir para a página do Mercado Pago") sugere que o redirect URI ou o `client_id` podem estar incorretos, ou o token já existia. Porém, o código do fluxo OAuth em si está correto — o edge function retorna `client_id` e o frontend redireciona para `auth.mercadopago.com.br`. Isso precisa ser verificado com teste real, mas não há bug de código evidente além da RLS.

## Solução

### 1. PaymentStep.tsx — Usar RPC `get_public_payment_config`
Substituir a query direta `supabase.from("online_payment_config").select(...)` pela RPC `get_public_payment_config` que já existe e retorna os campos necessários (`enabled`, `accept_pix`, `accept_card`, `enable_for_delivery`, `connection_status`, `mp_public_key`).

### 2. OnlinePaymentStep.tsx — Usar RPC `get_public_payment_config`
Substituir as 2 queries diretas que buscam `mp_public_key` pela mesma RPC.

### 3. Verificação do fluxo OAuth
O fluxo OAuth em si (edge function + callback page) está correto. O problema de "não ir para a página do MP" pode ser porque o navegador já tinha uma sessão ativa no Mercado Pago e autorizou automaticamente. Isso é comportamento normal do MP quando o app já foi autorizado anteriormente.

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/components/menu/checkout/PaymentStep.tsx` | Linha 120-124: trocar `from("online_payment_config")` por `rpc("get_public_payment_config")` |
| `src/components/menu/checkout/OnlinePaymentStep.tsx` | Linhas 133-137 e 374-378: trocar queries diretas por `rpc("get_public_payment_config")` |

## O que NÃO muda
- Edge functions (mercadopago-oauth, mercadopago-charge)
- Policies RLS
- Callback page (MercadoPagoCallback.tsx)
- OnlinePaymentsSettings.tsx (já usa RPCs)
- Fluxo de pedidos, estoque, fiscal

