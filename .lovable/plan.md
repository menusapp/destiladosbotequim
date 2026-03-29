

# Correção: Pagamento Misto no PDV + Itens de Mesa com Pagamento

## Problemas Identificados

### 1. Pagamento Misto não mostra campos
O código do mixed payment **existe** (linhas 492-564 do `CreateOrderDrawer.tsx`), mas há um bug na lógica do `Select` de pagamento. Na linha 440, o `value` do Select usa uma expressão ternária complexa que mapeia "Crédito - Visa" de volta para "credit". Porém, quando o usuário seleciona "mixed", se o estado anterior era uma string com bandeira (ex: "Vale - Alelo"), o `onValueChange` pode não disparar corretamente porque o Select fica "preso" num valor inválido. Além disso, a seção de pagamento inteira (incluindo mixed) está **dentro** do scroll do formulário e pode ficar oculta.

**Correção**: Separar o estado `paymentType` em dois: o **método base** (`cash`, `credit`, `debit`, `pix`, `meal_voucher`, `mixed`) e a **bandeira** em um estado separado (`selectedBrand`). Isso simplifica a lógica do Select e garante que "mixed" sempre funcione.

### 2. Pedido de mesa com pagamento — itens "pagos"
Quando um pedido de mesa é criado no PDV com método de pagamento definido, os itens desse pedido devem ser considerados "pagos". Itens adicionados depois (via comanda ou novo pedido) ficam sem pagamento. O `orders.payment_type` já é por pedido, então a informação já está lá. O que falta é **mostrar visualmente** na tela de detalhes da mesa quais itens já têm pagamento associado.

## Plano de Implementação

### Arquivo 1: `src/components/admin/CreateOrderDrawer.tsx`

**a) Refatorar estado de pagamento:**
- Criar estado `paymentMethod` (método base: cash, credit, debit, pix, meal_voucher, mixed)
- Criar estado `paymentBrand` (bandeira: visa, mastercard, etc.)
- Remover a lógica complexa da prop `value` do Select (linha 440)
- O Select de método usa `paymentMethod` diretamente
- Quando `paymentMethod` muda para "credit"/"debit", mostrar Select de bandeira separado
- Quando `paymentMethod` = "mixed", exibir UI de pagamento misto (que já existe)

**b) Resolver `paymentType` final no submit:**
- `cash` → "Dinheiro", `pix` → "PIX"
- `credit` + brand "visa" → "Crédito - Visa", payment_brand = "visa"
- `mixed` → concatenação como já faz

**c) Manter toda a UI de mixed payment existente** (linhas 492-564), apenas alterar a condição de `paymentType === "mixed"` para `paymentMethod === "mixed"`

### Arquivo 2: `src/components/admin/TableDetailView.tsx`

**a) Mostrar badge de pagamento nos itens:**
- Na lista de itens por comanda/pedido, se o `order.payment_type` estiver preenchido, exibir um badge "Pago - {método}" ao lado dos itens daquele pedido
- Itens de pedidos sem `payment_type` continuam sem badge (pendentes de pagamento)

## Arquivos Impactados
- `src/components/admin/CreateOrderDrawer.tsx` — refatorar estado de pagamento, garantir mixed funcione
- `src/components/admin/TableDetailView.tsx` — badge visual de pagamento nos itens

