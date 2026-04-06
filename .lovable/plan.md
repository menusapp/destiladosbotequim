

# Plan: Otimizar pagamento de comanda + Corrigir pagamentos divididos nos relatórios

## Diagnóstico

### Correção 1 — Performance do pagamento
O `handlePaymentConfirmed` em `TableDetailDialog.tsx` (linhas 321-365) executa tudo sequencialmente:
- Loop sequencial por cada order: fetch status → RPC deduct_stock → update status (3 calls por pedido)
- Depois: update comanda, update bills, fetch remaining comandas, update table
- Total para 3 pedidos: ~12 chamadas sequenciais

O `handleConfirmPayment` em `PaymentConfirmationModal.tsx` (linhas 202-351) também é sequencial:
- Update orders → find bill → update/insert bill → delete cash_movements (3 calls) → find cash session → insert movements em loop

### Correção 2 — Pagamentos divididos nos relatórios
Quando há pagamento misto, o `PaymentConfirmationModal` salva `payment_method: null` no bill (linha 215: `uniqueTypes.length === 1 ? uniqueTypes[0] : null`). O `normalizeMethod` no `ReportsTab` retorna `null` para isso, e `addToPaymentTotal` ignora — resultado: valor some dos relatórios.

No `useOrderMetrics`, a lógica é diferente: usa `addMethodRevenue` que trata `null` como "Outros". Mas para bills com `payment_method: null` de pagamento misto, o valor total vai todo para "Outros" em vez de ser desagregado.

**Solução**: Adicionar coluna `payment_splits jsonb` na tabela `bills`. Salvar os detalhes de cada parte do pagamento. Nos relatórios, quando `payment_splits` existir, iterar sobre ele em vez de usar `payment_method`.

## Mudanças

### 1. Migration — Adicionar coluna `payment_splits` na tabela `bills`
```sql
ALTER TABLE public.bills ADD COLUMN payment_splits jsonb DEFAULT NULL;
```
Formato: `[{"method": "cash", "display": "Dinheiro", "amount": 50.00}, {"method": "credit", "display": "Crédito - Visa", "amount": 58.60, "brand": "visa"}]`

### 2. `PaymentConfirmationModal.tsx` — Salvar payment_splits + otimizar
- Construir array `payment_splits` a partir de `selectedPayments`
- Salvar no bill: `payment_splits` com detalhes, `payment_method` mantém o tipo único ou `null` para misto (backward compat)
- Paralelizar: cash_movements cleanup (3 deletes) com `Promise.all`
- Paralelizar: cash_movements inserts com `Promise.all`
- Adicionar `loading` state no botão "Confirmar Pagamento" (desabilitar imediatamente ao clicar)

### 3. `TableDetailDialog.tsx` — Otimizar `handlePaymentConfirmed`
- Paralelizar stock deduction + status update por order usando `Promise.all`
- Paralelizar: close comanda + update bills + check remaining em grupo
- Paralelizar: `refetchComandas()`, `refetchOrders()`, `refetchBills()` não precisam ser sequenciais (já são independentes, mas ficam mais claros)

### 4. `useOrderMetrics.ts` — Desagregar payment_splits
- No fetch de `bills`, adicionar `payment_splits` ao select
- Em `addMethodRevenue`: quando o bill tem `payment_splits` (array JSON), iterar sobre cada split e somar ao método correto em vez de usar `payment_method`

### 5. `ReportsTab.tsx` — Desagregar payment_splits no DRE
- No fetch de `bills`, adicionar `payment_splits` ao select
- Em `addToPaymentTotal` para bills: se `payment_splits` existir e for array, iterar sobre cada split e somar ao método correto. Caso contrário, usar `payment_method` como antes (backward compat com registros antigos)

## Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar `payment_splits jsonb` em `bills` |
| `src/components/admin/PaymentConfirmationModal.tsx` | Salvar splits, loading state, paralelizar cleanup |
| `src/components/admin/TableDetailDialog.tsx` | Paralelizar operações no pagamento |
| `src/hooks/useOrderMetrics.ts` | Ler e desagregar `payment_splits` |
| `src/components/admin/ReportsTab.tsx` | Ler e desagregar `payment_splits` |

## O que NÃO muda
- Lógica de negócio do pagamento (ordem de operações, validações)
- Fluxo de delivery, iFood, Delivery Direto, fiscal
- Schema de outras tabelas
- Registros existentes (payment_splits = null, lidos pelo fallback)
- Split por item (SplitPaymentDialog) — funcionalidade diferente

