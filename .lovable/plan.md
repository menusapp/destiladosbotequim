

## Plano: 3 Correções — Prévia permanente nas mesas, Logout ao pagar, Split payment no caixa

---

### 1. Mesas sempre mostram nomes de clientes e prévia de pedidos (não só pending)

**Problema**: As cards de mesa só mostram nome/prévia quando há pedidos `pending`. Quando o pedido é aceito/preparando, a info desaparece da card.

**Correção no PDVTab.tsx**:
- A query de `tables` já busca comandas ativas com `customer_name` — usar isso para sempre mostrar nomes dos clientes nas cards de mesas ocupadas
- Adicionar query separada (ou expandir a existente) para buscar contagem de order_items ativos (qualquer status não-final) agrupados por `table_id`
- Na card da mesa: sempre mostrar nomes das comandas ativas + total de itens, independente do status do pedido
- Manter o badge "Pedido Novo" apenas para pedidos `pending`

**Arquivo**: `PDVTab.tsx` (linhas 470-490, card content + nova query)

---

### 2. Logout não funciona após pagamento

**Problema**: No `PaymentConfirmationModal.handleConfirmPayment`, ao buscar bills existentes com `.eq("status", "paid")`, pode encontrar uma bill anterior (de outro pagamento ou do `handleClearTable`), fazendo UPDATE em vez de INSERT de uma nova bill com o `comanda_id` correto. Isso impede o listener do `Comanda.tsx` de detectar a nova bill paga.

**Correção no PaymentConfirmationModal.tsx**:
- Ao lidar com pagamento de mesa, **sempre criar nova bill** com `comanda_id` e `status: "paid"` (não tentar reutilizar bill existente)
- Remover a lógica de buscar `existingBills` com status `paid` — essa lógica era para re-edição de pagamento, mas conflita com o fluxo de múltiplas comandas
- O `handlePaymentConfirmed` no `TableDetailDialog` já fecha a comanda e marca pedidos como delivered — combinado com a nova bill, o realtime vai acionar o logout

**Arquivo**: `PaymentConfirmationModal.tsx` (linhas 175-193)

---

### 3. Split payment: apenas primeiro método entra no caixa

**Problema**: O trigger `add_local_order_to_cash_register` cria UMA entrada no caixa por pedido, usando `orders.payment_type`. Mas `payment_type` recebe apenas `primaryPayment` (primeiro método do split). Os demais métodos e seus valores são ignorados.

**Correção**:
- No `PaymentConfirmationModal.handleConfirmPayment`, em vez de depender do trigger, criar cash_movements manualmente para cada parcela do split payment
- Para cada entrada em `selectedPayments`, inserir um `cash_movement` separado com o respectivo método e valor
- Salvar `orders.payment_type` como string com todos os métodos (ex: "Dinheiro, PIX") para referência
- Na bill, salvar `payment_method` como string concatenada dos métodos usados
- Buscar `cash_session_id` ativo para o restaurante e criar as entradas diretamente

**Arquivo**: `PaymentConfirmationModal.tsx` (linhas 159-201)

---

### Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | Cards de mesa sempre mostram nomes das comandas ativas + contagem de itens de todos os pedidos ativos |
| `PaymentConfirmationModal.tsx` | Sempre inserir nova bill (não reusar); criar cash_movements individuais por método de pagamento do split |

