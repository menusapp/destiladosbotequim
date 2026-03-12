

## Plano: Corrigir 2 bugs

### Bug 1: "Erro ao enviar pedido" — FK violation nos complementos

**Causa raiz**: A correção anterior de complementos (em `Menu.tsx` e `DeliveryMenu.tsx`) mapeia `extra_category_items.id` como o `id` do extra. Quando o pedido é enviado, esse ID é inserido como `product_extra_id` em `order_item_extras`, que tem FK para `product_extras` — não para `extra_category_items`. Resultado: violação de FK → erro.

**Correção**: Em `Comanda.tsx` (e possivelmente em `Menu.tsx`/`DeliveryMenu.tsx` no checkout), ao inserir `order_item_extras`, setar `product_extra_id: null` quando o extra vem de um complement group (não é um product_extra real). Alternativa mais robusta: na hora de mapear complementos, marcar com um flag `is_complement: true` e na inserção de extras do pedido, usar `product_extra_id: null` para esses.

**Arquivos**:
- `src/pages/Menu.tsx` — adicionar flag `is_complement` ao mapear extras de complementos
- `src/pages/DeliveryMenu.tsx` — idem
- `src/pages/Comanda.tsx` — ao inserir `order_item_extras`, usar `product_extra_id: null` quando `is_complement === true`
- Verificar também o fluxo de checkout em `CheckoutDrawer.tsx` ou onde o delivery faz insert de order_item_extras

### Bug 2: "Limpar Mesa" não desloga clientes nem zera contas

**Situação atual**: `handleClearTable` apenas fecha comandas e marca mesa como livre. Falta:
1. Fechar/cancelar bills pendentes (`status != 'paid'`)
2. Cancelar pedidos ativos (`pending`, `preparing`, `ready`)

**Correção** em `UnifiedOrdersTab.tsx` → `handleClearTable`:
- Cancelar pedidos ativos: `UPDATE orders SET status = 'cancelled' WHERE table_id = X AND status IN ('pending','accepted','preparing','ready')`
- Fechar bills não pagas: `UPDATE bills SET status = 'cancelled' WHERE table_id = X AND status != 'paid'`
- Já fecha comandas e libera mesa (existente)

O logout dos clientes acontece automaticamente: quando a mesa fica `is_occupied = false` e comandas ficam `closed`, o Menu.tsx detecta isso via realtime e redireciona.

### Resumo

| Arquivo | Mudança |
|---|---|
| `src/pages/Menu.tsx` | Adicionar `is_complement: true` no mapeamento de complement extras |
| `src/pages/DeliveryMenu.tsx` | Idem |
| `src/pages/Comanda.tsx` | Usar `product_extra_id: null` para extras com `is_complement` |
| `src/components/admin/UnifiedOrdersTab.tsx` | Cancelar pedidos ativos e bills pendentes ao limpar mesa |

