

# Plano -- Corrigir Integração Delivery Direto (Baseado na Documentacao Oficial)

## Diagnostico

Analisei toda a documentacao oficial da API do Delivery Direto. Identifiquei 3 problemas criticos que impedem o funcionamento:

### Problema 1: Content-Type errado na autenticacao
A `dd-auth` envia o body como `application/x-www-form-urlencoded`, mas a documentacao oficial exige `Content-Type: application/json` com body em JSON. Por isso a autenticacao funciona (status 200) mas os webhooks podem nao estar sendo registrados corretamente.

### Problema 2: `refresh_token` nao esta sendo salvo
O endpoint `/admin-api/token` retorna `access_token`, `refresh_token` e `expires_in` (6 horas). O `refresh_token` nao esta sendo salvo na tabela `deliverydireto_config` (que ja tem a coluna `refresh_token`). Sem ele, quando o token expira, nao ha como renovar automaticamente.

### Problema 3: Nenhum mecanismo de polling
O sistema depende 100% de webhooks do DD chamarem a edge function `dd-webhook`. Porem, os webhooks podem nao estar funcionando (URL nao acessivel, registro incorreto, etc). A solucao definitiva e adicionar **polling ativo** via `GET /admin-api/v1/orders`, identico ao que ja existe para o iFood.

---

## Alteracoes

### 1. Corrigir `dd-auth/index.ts`

- Mudar `Content-Type` de `application/x-www-form-urlencoded` para `application/json`
- Mudar o body de `URLSearchParams` para `JSON.stringify({...})`
- Salvar o `refresh_token` retornado na tabela `deliverydireto_config`
- Implementar renovacao de token usando `grant_type: refresh_token` em vez de retornar erro
- Manter webhook registration como bonus (pode funcionar, nao atrapalha)

### 2. Criar `dd-polling/index.ts` (nova edge function)

Funcao identica ao `ifood-polling` mas para Delivery Direto:
- Recebe `restaurant_id`
- Busca config da `deliverydireto_config`
- Verifica/renova token automaticamente via `refresh_token`
- Chama `GET /admin-api/v1/orders?updatedAt[gte]=<lastSync>` com headers corretos
- Para cada pedido novo encontrado, insere na tabela `orders` com `dd_source: true` e `dd_order_id`
- Salva timestamp da ultima sincronizacao na config
- Retorna `{ success: true, new_orders: N }`

### 3. Adicionar polling do DD no `UnifiedOrdersTab.tsx`

- Adicionar um `useEffect` com `setInterval(30000)` chamando `dd-polling`, identico ao do iFood
- Quando `new_orders > 0`, chamar `fetchOrders()` e exibir toast

### 4. Adicionar coluna `last_sync_at` na `deliverydireto_config`

- Migration para adicionar `last_sync_at timestamptz` (para o polling saber de onde buscar)

### 5. Manter `dd-webhook` funcionando

- Nao alterar -- se o DD conseguir chamar o webhook, ele funciona como bonus
- O polling garante que pedidos chegam mesmo sem webhook

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/dd-auth/index.ts` | Corrigir Content-Type para JSON, salvar refresh_token, implementar renovacao via refresh_token |
| `supabase/functions/dd-polling/index.ts` | **Novo** -- polling ativo de pedidos via Admin API |
| `src/components/admin/UnifiedOrdersTab.tsx` | Adicionar polling do DD a cada 30s |
| Migration SQL | Adicionar coluna `last_sync_at` na `deliverydireto_config` |

Nenhum fluxo existente (iFood, pedidos locais, mesas) sera alterado.

