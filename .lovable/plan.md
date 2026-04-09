
# Corrigir caixa detalhado, duplicidade em delivery e desconto dentro da mesa

## Diagnóstico confirmado
- O delivery/retirada está abrindo no modo ruim do caixa porque o movimento entra sem vínculo navegável com o pedido. Sem `bill_id` útil e sem `order_id`, o `CashMovementDetailSheet` cai no modo manual e mostra tudo em `description`.
- A duplicidade acontece em `PaymentConfirmationModal.tsx`: ao confirmar pagamento ele lança `cash_movements` para qualquer pedido. Depois, quando o pedido delivery/retirada é finalizado, o trigger `add_delivery_order_to_cash_register` lança outro movimento.
- O desconto ainda está quebrado dentro da mesa em `TableDetailDialog.tsx`: a query não traz `coupon_discount` e `getOrderTotal()` soma bruto. Por isso o total da comanda, o total da mesa e o modal de pagamento cobram valor cheio.

## Plano de implementação

### 1) Parar de usar `description` como “espelho do pedido” no caixa
Criar uma migration pequena e segura:
- adicionar `order_id uuid null references public.orders(id) on delete set null` em `cash_movements`
- indexar `order_id`
- atualizar `add_delivery_order_to_cash_register()` para:
  - inserir `order_id = NEW.id`
  - usar descrição curta para a lista (ex.: `Pedido Delivery - Artur`)
  - usar checagem de duplicidade por `order_id`, não por texto da descrição
  - manter entrada no caixa só na transição para `delivered` / `picked_up`

Resultado: o detalhe do caixa deixa de depender de texto concatenado e passa a abrir um espelho real do pedido.

### 2) Corrigir a duplicidade: pagamento confirmado não pode lançar caixa em delivery
Em `PaymentConfirmationModal.tsx`:
- manter atualização de `payment_type`, `payment_brand`, `payment_status` e `paid_at`
- manter criação/atualização de `bill` apenas para pedidos locais/comanda
- **bloquear criação de `cash_movements` quando o pedido for `delivery` / `pickup` / `takeaway`**
- deixar o caixa desses pedidos exclusivamente para o trigger de finalização

Isso preserva a regra correta:
- local/comanda: entra no caixa ao confirmar pagamento
- delivery/retirada/viagem: entra no caixa só ao entregar/retirar de fato

### 3) Fazer o detalhe do caixa de delivery/retirada ficar igual ao “Espelho do Pedido”
Em `CashMovementDetailSheet.tsx`:
- buscar primeiro por `movement.order_id`
- se existir, renderizar o mesmo layout rico de espelho (sem bloco “Descrição”)
- manter fallback atual para:
  - `bill_id` em pedidos locais/comandas
  - movimentos realmente manuais

Ajustes de apresentação:
- mostrar `Responsável: Sistema` **somente** quando `order.pdv_source === true`
- para pedidos não criados no painel, começar direto em cliente/origem/pagamento
- separar:
  - **Origem**: PDV, Mesa via QR Code, Cardápio Digital, Totem, Delivery Direto, iFood
  - **Categoria/Modalidade**: Mesa, Delivery, Retirada, Viagem
- exibir forma de pagamento com bandeira e, quando houver, “Troco para / Troco”
- manter produtos em boxes com adicionais agrupados por categoria
- exibir subtotal, desconto e total no rodapé, sem depender de `description`

### 4) Ajustar a lógica de origem para todos os pedidos PDV vs digitais
Padronizar a origem usando os campos já existentes (`pdv_source`, `order_channel`, `dd_source`, `ifood_source`, `table_id`, `delivery_type`):
- mesa + `pdv_source`: `Mesa X via PDV`
- mesa sem `pdv_source`: `Mesa X via QR Code`
- delivery/retirada/viagem + `pdv_source`: `PDV - Entrega/Retirada/Viagem`
- `order_channel = totem`: `Totem`
- `dd_source`: `Delivery Direto`
- `ifood_source`: `iFood`
- restante online: `Cardápio Digital`

Vou concentrar essa regra em helper compartilhado para evitar divergência entre `CashMovementDetailSheet` e `OrderDetailModal`.

### 5) Corrigir desconto dentro da mesa e no pagamento da comanda
Em `TableDetailDialog.tsx`:
- incluir `coupon_discount` e `notes` no select de `orders`
- fazer `getOrderTotal(order)` retornar:
  - soma dos itens + extras
  - menos `order.coupon_discount`
- refletir isso em:
  - total por pedido
  - total da comanda
  - total da mesa
  - resumo financeiro com divisões
  - criação de `virtualOrder` enviado para `PaymentConfirmationModal`
  - bill final gerado ao fechar comanda

No UI da mesa:
- mostrar linha de desconto quando houver
- valor do botão/total da comanda passa a bater com o valor real pago

### 6) Corrigir o modal de pagamento para cobrar o valor com desconto
Em `PaymentConfirmationModal.tsx`:
- incorporar `order.coupon_discount` no cálculo final
- exibir linha “Desconto” no resumo
- calcular restante/pago considerando desconto
- preservar taxa de serviço e divisões já existentes

Assim, ao clicar em pagar a comanda, o modal deixa de cobrar o valor cheio.

### 7) Garantir consistência também na impressão a partir da mesa
Em `TableDetailDialog.tsx`:
- ao imprimir pedido individual ou comanda completa, passar `coupon_discount` e `notes` para `printOrder`
- no caso da comanda completa, somar o desconto total agregado

Isso evita que a impressão disparada dentro da mesa volte a sair sem desconto.

## Observações de estabilidade
- Não vou mexer em fiscal, iFood, Delivery Direto, polling ou fluxo operacional de preparo.
- Não vou fazer backfill arriscado dos movimentos antigos do caixa, porque hoje eles não têm vínculo determinístico com o pedido; heurística por texto/valor/hora poderia associar errado. A correção fica sólida para os novos lançamentos.
- A mudança no caixa fica isolada a:
  - vínculo do movimento com o pedido
  - momento correto de lançamento financeiro
  - renderização do detalhe

## Arquivos impactados
- `supabase/migrations/...sql` — adicionar `cash_movements.order_id` e substituir `add_delivery_order_to_cash_register`
- `src/components/admin/CashMovementDetailSheet.tsx`
- `src/components/admin/PaymentConfirmationModal.tsx`
- `src/components/admin/TableDetailDialog.tsx`
- `src/components/admin/OrderDetailModal.tsx` (para reutilizar origem padronizada, se necessário)
- `src/lib/printOrder.ts` ou helper compartilhado de apresentação/origem

## Resultado esperado
- Delivery/retirada/viagem passam a abrir no caixa com espelho detalhado, não com textão em descrição
- `Responsável: Sistema` aparece só em pedidos PDV
- Confirmar pagamento em delivery não gera mais entrada antecipada nem duplicada
- Dentro da mesa, descontos aparecem e o valor cobrado/pago passa a ser o valor correto
