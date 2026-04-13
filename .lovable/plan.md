

## Plano: Corrigir duplicatas no caixa + realtime + abrir mesa pela notificação

### Problema 1 — Pedidos duplicados no caixa (CRÍTICO)

**Causa raiz identificada**: Existem DOIS caminhos que inserem movimentações no caixa para pedidos locais:

1. **Trigger de banco** `add_local_order_to_cash_register` — dispara quando `payment_type` muda de null para um valor real. Insere com `order_id` preenchido.
2. **PaymentConfirmationModal** (frontend) — insere manualmente ao confirmar pagamento. Insere **sem** `order_id` (null).

Quando o operador confirma pagamento pela modal, o UPDATE no `orders.payment_type` dispara o trigger (entrada 1) e a modal também insere (entrada 2). A limpeza da modal usa `LIKE` por nome do cliente na descrição, que não encontra a entrada do trigger (formato diferente).

**Solução**: Fazer o `PaymentConfirmationModal` sempre usar `order_id` nas suas inserções de `cash_movements` e, na limpeza, deletar por `order_id` em vez de pattern matching frágil. Assim:
- Deletar `WHERE order_id IN (targetOrderIds)` antes de inserir
- Inserir com `order_id` preenchido
- Isso garante que tanto o trigger quanto a modal não criem duplicatas, porque a modal limpa tudo do pedido antes de recriar

Também adicionar deduplicação no trigger: checar se já existe `cash_movement` com aquele `order_id` antes de inserir (já existe parcialmente mas a description pattern é diferente).

### Problema 2 — Realtime no PDV

O realtime já está configurado corretamente no PDVTab (canal `pdv-tables-rt` escutando tables, comandas, orders). O canal de notificações em `RestaurantAdmin.tsx` também funciona. O problema relatado pode ser intermitente por falta de filtro por `restaurant_id` no canal — todos os eventos de todos restaurantes chegam e são processados.

**Solução**: Adicionar `filter: restaurant_id=eq.${restaurantId}` nos canais de realtime do PDV para reduzir ruído e melhorar performance.

### Problema 3 — Notificação de mesa deve abrir a mesa no PDV

O mecanismo `pendingTableToOpen` já existe e funciona, mas tem um bug sutil: o `useEffect` que consome `pendingTableToOpen` depende de `tables` estar carregado. Se o PDV ainda está em loading quando o `pendingTableToOpen` é setado, o efeito roda mas `tables` é undefined, e o `onTableOpened()` nunca é chamado. Quando `tables` finalmente carrega, o `pendingTableToOpen` já foi consumido.

**Solução**: Não chamar `onTableOpened()` se a mesa não foi encontrada, para que o efeito tente novamente quando `tables` atualizar. Só chamar `onTableOpened()` quando realmente encontrar e abrir a mesa.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/PaymentConfirmationModal.tsx` | Limpeza por `order_id` + inserção com `order_id` |
| `src/components/admin/PDVTab.tsx` | Filtro `restaurant_id` no realtime + fix no auto-open |
| Migration SQL | Atualizar trigger `add_local_order_to_cash_register` para checar `order_id` existente |

### Resultado esperado
- Cada pedido gera exatamente UMA entrada no caixa
- Métricas e relatórios refletem valores corretos sem duplicatas
- Realtime filtrado por restaurante, mais rápido e sem ruído
- Clicar "Ver pedido" na notificação de mesa abre a mesa corretamente no PDV

