

## Plano: Fix — Extras do iFood não inseridos (FK violation)

### Problema
O matching de extras funciona corretamente (o log mostra `✓ OPTION "Sim, quero Combo" matched by code "040"`), mas a inserção falha porque o campo `product_extra_id` na tabela `order_item_extras` tem uma foreign key para `product_extras`, e estamos inserindo o ID de `extra_category_items` — que é outra tabela.

Erro exato:
```
Key (product_extra_id)=(3adf923b...) is not present in table "product_extras".
```

### Solução
No `ifood-polling/index.ts`, ao montar os extras para inserção (linha ~455-459), setar `product_extra_id: null` em vez de usar o ID do `extra_category_items`. O campo `extra_name` e `price_at_order` já são preenchidos corretamente e são suficientes para exibição no sistema.

### Arquivo alterado
- `supabase/functions/ifood-polling/index.ts` — linha 457: trocar `ex.matchedExtraId` por `null`

### Impacto
Correção pontual de 1 linha. Nenhuma outra mudança necessária. O nome e preço do extra já ficam salvos corretamente.

