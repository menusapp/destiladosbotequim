

## Plano: Comandas na Aba Local, Pagamento no Caixa, e Forma de Pagamento nos Cards

---

### 1. Toggle "Pedir Conta" + Kanban de Comandas na Aba Local

**Situacao atual**: O toggle existe em `renderBillsSection()` mas so aparece se ha bills filtradas. O usuario quer que o toggle fique visivel sempre na aba Local, e que comandas solicitadas aparecam como uma coluna extra do Kanban.

**Solucao em `UnifiedOrdersTab.tsx`**:
- Mover o switch "Pedir conta pelo cardapio" para o header da aba Local (sempre visivel quando `activeTab === "local"`)
- Quando `billRequestEnabled` estiver ativo, adicionar uma coluna extra ao kanban na aba Local: **"Contas Solicitadas"** com `bg-orange-500` tom diferenciado
- Essa coluna mostra as bills com status `requested` e `on_the_way` como cards (mesa, cliente, valor, botoes de acao)
- Acoes nos cards de conta: "A caminho" (muda status para `on_the_way`) e "Para pagar use PDV ou Mesas"
- Se `billRequestEnabled` for `false`, a coluna de contas nao aparece

---

### 2. Pedidos Locais — So entrar no caixa quando pago

**Problema**: O trigger `add_local_order_to_cash_register` insere um `cash_movement` com `payment_method = 'pending'` quando o status muda para `accepted`. Isso faz pedidos locais aparecerem no caixa antes de serem pagos.

**Solucao — Migration SQL**: Alterar a funcao trigger para NAO criar cash_movement ao aceitar pedido local. Em vez disso, criar o cash_movement apenas quando o pagamento for confirmado. Duas opcoes:

**Opcao escolhida**: Modificar o trigger `add_local_order_to_cash_register` para so criar o cash_movement quando `payment_type` for definido (nao nulo e diferente de `pending`). Adicionar uma nova condicao no trigger que detecta quando `payment_type` muda de NULL/pending para um valor real.

Tambem: No `PaymentConfirmationModal`, apos confirmar pagamento, criar o `cash_movement` com o metodo correto se o pedido for local e nao tiver cash_movement ainda. Buscar a sessao de caixa aberta e inserir.

---

### 3. Forma de Pagamento nos Cards do Kanban

**Solucao em `UnifiedOrdersTab.tsx` — `renderOrderCard()`**:
- Adicionar uma linha no card mostrando a forma de pagamento:
  - Se `order.payment_type` existe e nao e `pending` → mostrar o metodo (ex: "💳 Credito", "💵 Dinheiro") em texto verde/neutro
  - Se `order.payment_type` e `null` ou `pending` → mostrar **"⚠ Falta pagamento"** em vermelho (`text-red-600 bg-red-50`)
- Na logica de status do `OrderDetailModal`, bloquear a mudanca para `delivered`/`picked_up` se `payment_type` for nulo:
  - Nos botoes "Confirmar Entrega", "Entregar na Mesa", "Confirmar Retirada": antes de chamar `updateStatus`, verificar se `order.payment_type` existe
  - Se nao existir, mostrar `toast.error("Defina a forma de pagamento antes de finalizar o pedido")` e abrir o modal de pagamento

---

### Resumo de Arquivos

**Migration SQL**: 1 migration para alterar a funcao `add_local_order_to_cash_register` — so criar cash_movement quando `payment_type` for definido (nao nulo/pending)

**Modificar**:
- `src/components/admin/UnifiedOrdersTab.tsx` — Coluna kanban de contas na aba Local, toggle sempre visivel, forma de pagamento nos cards
- `src/components/admin/OrderDetailModal.tsx` — Bloquear finalizacao sem pagamento definido
- `src/components/admin/PaymentConfirmationModal.tsx` — Criar cash_movement ao confirmar pagamento de pedido local

