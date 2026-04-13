

## Plano: Corrigir detecção de WhatsApp no Marketing + erro 406

### Problema 1 — WhatsApp aparece desconectado no Marketing

**Causa raiz**: A edge function `whatsapp-instance` resolve o nome da instância como `rest-ravih-rooftop` (slug) e faz fallback para `rest-9a786bc0` (8 chars do UUID). Porém no banco, o `instance_name` salvo é `rest-8947a1f1` — nenhum dos dois nomes bate. A Evolution API retorna 404 para ambos, e a função retorna `status: "not_created"`, mesmo com `instance_status: "connected"` no banco.

**Correção (2 camadas)**:

1. **`whatsapp-instance/index.ts`** — Na função `resolveInstanceName`, também retornar o `instance_name` salvo no banco como terceira opção de fallback. Alterar `tryCheckState` para tentar os 3 nomes: slug-based → uuid-based → DB-saved.

2. **`MarketingTab.tsx`** — Quando a API retorna `status !== "connected"`, usar o `instance_status` do banco como fallback (atualmente só faz fallback em caso de exceção de rede). Simplificar: confiar no campo `config.instance_status` retornado pela própria API quando o status principal é "not_created".

### Problema 2 — Erro 406

**Causa provável**: A query na `CampaignsList.tsx` faz `supabase.from("orders").select("id, order_items(price_at_order, quantity)").in("coupon_code", couponCodes)` — se não houver FK reconhecida entre `orders` e `order_items` pelo PostgREST, ou se o header `Accept` não estiver configurado corretamente, retorna 406.

**Correção**: Separar a query em duas chamadas independentes (buscar orders, depois buscar order_items pelo order_id), evitando a relação embutida que pode causar 406.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-instance/index.ts` | Adicionar instance_name do DB como fallback em `tryCheckState` |
| `src/components/admin/MarketingTab.tsx` | Usar `config.instance_status` da resposta como fallback |
| `src/components/admin/marketing/CampaignsList.tsx` | Separar query de orders+order_items para evitar 406 |

### Resultado
- Marketing detecta WhatsApp conectado mesmo quando o nome da instância no banco difere do slug
- Sem erro 406 na aba de campanhas

