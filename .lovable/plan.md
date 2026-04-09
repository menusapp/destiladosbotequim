

# Fix 3 Pendências: Desconto na Impressão, Total da Mesa e Caixa de Delivery

## Resumo
Corrigir 3 bugs: (1) desconto não aparece na impressão, (2) desconto não subtrai do total da mesa, (3) movimentações de delivery no caixa mostram informações incompletas vs pedidos locais.

## Detalhes Técnicos

### 1. Impressão — Adicionar desconto no recibo (`src/lib/printOrder.ts`)

**Problema**: A função `printOrder` não recebe nem exibe `coupon_discount`. O total impresso é sempre o subtotal bruto.

**Solução**:
- Adicionar `coupon_discount?: number` e `discount_notes?: string` (extraído de notes) ao tipo do parâmetro `order`
- Na seção de total do HTML, entre a `double-line` e o `TOTAL`:
  - Se `coupon_discount > 0`, exibir linha "Subtotal: R$ X.XX"
  - Exibir linha "Desconto: - R$ X.XX"
  - Extrair motivo do desconto de `notes` (regex `\[Desconto: (.+?)\]`) e exibir "Motivo: ..."
  - TOTAL final = subtotal - coupon_discount

### 2. Atualizar chamadas de `printOrder` para incluir `coupon_discount`

**`PDVTab.tsx` (auto-print)**: O `printOrderObj` (linha 710-732) não inclui `coupon_discount`. Adicionar:
```
coupon_discount: calculatedDiscount > 0 ? calculatedDiscount : undefined
```

**`OrderDetailModal.tsx` e `UnifiedOrdersTab.tsx`**: Esses passam o `order` diretamente da query. Verificar se a query já puxa `coupon_discount`. Se não, adicioná-lo ao select.

**`useOrderStatusAdvance.ts`**: Mesmo — garantir que a query que carrega o order para auto-print inclui `coupon_discount`.

### 3. Total da mesa não subtrai desconto (`src/components/admin/TableDetailView.tsx`)

**Problema**: O cálculo do total da comanda (linhas 182-187) só soma items × quantity + extras. Não subtrai `coupon_discount` do pedido.

**Solução**:
- Adicionar `coupon_discount` ao select da query de orders (linha 145-165)
- Na interface `Order`, adicionar `coupon_discount?: number`
- No cálculo do total (linha 182), subtrair `coupon_discount`:
```typescript
const total = comandaOrders.reduce((sum, order) => {
  const itemsTotal = order.order_items.reduce((itemSum, item) => {
    const extrasSum = item.order_item_extras.reduce((s, e) => s + e.price_at_order, 0);
    return itemSum + (item.price_at_order + extrasSum) * item.quantity;
  }, 0);
  return sum + itemsTotal - (order.coupon_discount || 0);
}, 0);
```
- Na UI de exibição dos pedidos, mostrar linha de desconto quando `coupon_discount > 0`

### 4. Movimentações de delivery no caixa — Detalhes completos (Migration SQL)

**Problema**: O trigger `add_delivery_order_to_cash_register` gera descrição simples como texto (sem `bill_id`). O `CashMovementDetailSheet` mostra detalhes só quando há `bill_id`. Para pedidos locais, o `PaymentConfirmationModal` cria bill + cash_movement com `bill_id`, permitindo o sheet enriquecido.

**Solução**: Atualizar o trigger `add_delivery_order_to_cash_register` via migration para:
- Gerar descrição no mesmo formato dos pedidos locais: incluir lista de itens, subtotal, desconto, total
- OU criar um `bill` automaticamente para delivery orders e linkar no `bill_id` do cash_movement

A abordagem mais limpa: modificar a `description` do trigger para incluir dados detalhados no mesmo formato texto que os pedidos locais usam. Incluir itens com quantidades e preços.

Migration SQL atualiza o trigger para buscar items do pedido e montar descrição com:
- Nome do cliente + CPF
- Tipo (Entrega/Retirada)
- Forma de pagamento
- Lista de produtos (qty x nome = preço)
- Subtotal, Taxa entrega, Desconto, Total

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `src/lib/printOrder.ts` | Adicionar suporte a `coupon_discount` no recibo |
| `src/components/admin/PDVTab.tsx` | Passar `coupon_discount` ao auto-print |
| `src/components/admin/TableDetailView.tsx` | Buscar e subtrair `coupon_discount` no total da mesa |
| `src/components/admin/OrderDetailModal.tsx` | Incluir `coupon_discount` na query |
| `src/components/admin/UnifiedOrdersTab.tsx` | Incluir `coupon_discount` na query |
| `src/hooks/useOrderStatusAdvance.ts` | Incluir `coupon_discount` na query de auto-print |
| Migration SQL | Atualizar trigger `add_delivery_order_to_cash_register` com descrição detalhada |

## O que NÃO muda
- Fluxo de criação de pedidos (handleSubmit)
- PaymentConfirmationModal (local orders — já funciona)
- Trigger `add_local_order_to_cash_register`
- Fiscal, iFood, Delivery Direto
