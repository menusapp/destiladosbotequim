
Objetivo

- Fazer todo pedido pago no Totem entrar imediatamente em:
  - Visão Geral
  - Relatório RE / DRE
  - Fluxo de Caixa
- Mostrar método + bandeira corretamente, sem duplicar lançamento quando o pedido muda de status depois.

Diagnóstico do código

- `src/hooks/useOrderMetrics.ts` soma só:
  - `bills` pagos
  - `orders` de delivery finalizados
  - `counter_orders` pagos
- Os pedidos do Totem ficam em `orders` com `order_channel: "totem"`, então hoje ficam fora dessas métricas.
- `src/components/admin/ReportsTab.tsx` repete a mesma lógica, então o RE/DRE também ignora Totem.
- `src/components/admin/ProductPerformanceSection.tsx` funciona porque lê os `order_items` direto, por isso só os produtos aparecem.
- `src/components/kiosk/KioskPayment.tsx` cria o pedido pago, mas só atualiza `payment_status` e `paid_at`; não cria entrada de caixa.
- Os triggers legados de caixa trabalham por mudança de `status` operacional (`accepted`, `delivered`, `picked_up`) e não pelo pagamento do Totem, então pedido Totem pago não entra no caixa no momento certo.

Implementação

1. Incluir Totem nas métricas da Visão Geral
- Atualizar `src/hooks/useOrderMetrics.ts` para buscar também:
  - `orders`
  - `order_channel = 'totem'`
  - `payment_status = 'paid'`
  - período baseado em `paid_at`
- Somar esses pedidos em:
  - `totalSales`
  - `ordersCount`
  - `averageTicket`
  - `hourlySales` / `dailySales`
  - `revenueByMethod`
- Classificar:
  - `localSales` para `order_type = 'local'` ou `'balcao'`
  - `deliverySales` para `order_type = 'delivery'`

2. Incluir Totem no RE / DRE
- Atualizar `src/components/admin/ReportsTab.tsx` com a mesma fonte de pedidos pagos do Totem.
- Fazer “Vendas”, “Ticket Médio”, “Formas de Pagamento” e “Receita Bruta” refletirem o Totem pago imediatamente.
- Manter a regra:
  - Totem conta no `paid_at`
  - fluxos legados continuam como hoje

3. Corrigir entrada no caixa
- Criar migration para ajustar a automação de `cash_movements`.
- Lançar caixa quando:
  - `order_channel = 'totem'`
  - `payment_status` muda para `paid`
- Salvar no movimento:
  - `order_id`
  - `payment_method`
  - valor correto
  - descrição identificando Totem
- Deduplicar por `order_id`, para não lançar de novo quando o pedido depois virar `accepted`, `ready`, `delivered` etc.
- Ajustar a lógica legada para não relançar pedidos Totem já registrados.

4. Normalizar método de pagamento
- Ajustar normalização em métricas/relatórios/UI para aceitar corretamente:
  - `credit`
  - `debit`
  - `pix`
  - `voucher` / `meal_voucher`
- Preservar `payment_brand` para exibir:
  - `Crédito - Visa`
  - `Débito - Elo`
  - `PIX`
  - `Vale Refeição - ...`

5. Garantir total financeiro correto
- No cálculo de total do pedido Totem, usar o valor persistido no pedido:
  - itens + extras + taxa
  - menos cupom
  - menos desconto de fidelidade persistido
- Se existir `reward_discount`, usar esse valor como prioridade para bater com o valor realmente pago.

Arquivos

- `src/hooks/useOrderMetrics.ts`
- `src/components/admin/ReportsTab.tsx`
- migration SQL para trigger/função de `cash_movements`
- possivelmente `src/lib/utils.ts` para normalização de `voucher`

Validação

- Testar no admin, após pagar no Totem:
  - Visão Geral: Vendas Totais, Pedidos, gráfico por hora/dia, Receita por Método
  - RE / DRE: Receita Bruta e pagamentos
  - Caixa: entrada criada automaticamente e só uma vez
  - Pedido: método e bandeira corretos
- Cenários mínimos:
  - Totem balcão + PIX
  - Totem balcão + crédito com bandeira
  - Totem mesa + crédito
  - Totem para viagem/entrega, para garantir que não duplica ao finalizar operacionalmente
