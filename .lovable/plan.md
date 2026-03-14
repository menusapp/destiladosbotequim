

## Plano: 7 Arrumacoes

### 1. Realtime entre multiplos usuarios no admin

**Problema:** `UnifiedOrdersTab` e `TableDetailDialog` usam `useQuery` com `staleTime` de 5min (configurado no QueryClient). Quando um usuario aceita um pedido, o outro nao ve a mudanca ate atualizar.

**Solucao:**
- **UnifiedOrdersTab**: Ja tem realtime (`setupRealtime`) que chama `fetchOrders()` — isso funciona. Mas o `queryClient` global com `staleTime: 300000` pode impedir refetch. Precisamos garantir que o `fetchOrders` force a atualizacao.
- **TableDetailDialog**: Usa `useQuery` mas **nao tem realtime subscription**. Precisa adicionar listener para `orders`, `bills` e `comandas` com filtro `table_id` que chama `queryClient.invalidateQueries()`.
- **PDVTab**: Precisa ouvir mudancas em `tables`, `orders` e `comandas` para atualizar o mapa de mesas em tempo real.
- **FluxoCaixaTab**: Precisa ouvir `cash_movements` para atualizar em realtime.

**Arquivos**: `TableDetailDialog.tsx`, `PDVTab.tsx`, `FluxoCaixaTab.tsx`

---

### 2. Mostrar adicionais/complementos nos pedidos dentro do pop-up das mesas

**Problema:** Query em `TableDetailDialog.tsx` linha 87 busca `order_item_extras(price_at_order, product_extra_id)` mas **nao faz JOIN com `product_extras(name)` nem `extra_category_items`**, entao o nome do extra nao aparece.

**Solucao:**
- Alterar query para: `order_item_extras(price_at_order, product_extras(name), extra_category_items(name))`
- No render (linhas 416-426), mostrar nome do extra/complemento abaixo de cada item

**Arquivo**: `TableDetailDialog.tsx`

---

### 3. Tirar emojis do maximo de texto

**Problema:** Emojis espalhados em labels, badges, toasts e textos por todo o admin.

**Solucao:** Buscar e remover emojis de:
- `RestaurantAdmin.tsx` (ex: linha 499 `🕐`, 528 `🏪`, 541 `❌`, 543 `🎉 🔒`)
- `OrderDetailModal.tsx` (badge `⚠`)  
- `AppSidebar.tsx`, `FluxoCaixaTab.tsx`, `ReportsTab.tsx` e demais componentes admin
- Manter emojis apenas no menu do cliente (UX do consumidor final)

**Arquivos**: Multiplos componentes admin

---

### 4. Mostrar valor de entrega nos pedidos delivery

**Problema:** `OrderDetailModal` e `UnifiedOrdersTab` nao buscam nem exibem `delivery_fee`, `coupon_discount` ou `loyalty_points_used` do pedido.

**Solucao:**
- Adicionar `delivery_fee`, `coupon_discount`, `loyalty_points_used` na interface `Order` e na query de ambos componentes
- No `OrderDetailModal`, mostrar breakdown: Subtotal + Taxa de Entrega - Desconto = Total
- No card do kanban (`UnifiedOrdersTab`), mostrar taxa de entrega quando existir

**Arquivos**: `OrderDetailModal.tsx`, `UnifiedOrdersTab.tsx`

---

### 5. Tudo funcionar em realtime (coberto pelo item 1)

Mesma solucao: adicionar subscriptions realtime nos componentes que faltam.

---

### 6. Pop-up de suporte (robozinho)

**Solucao:** Criar componente `SupportChatWidget.tsx` — botao flutuante no canto inferior direito do admin com icone de headset/chat. Ao clicar, abre pop-up com opcoes:
- "Falar com suporte via WhatsApp" (abre link wa.me)
- "Enviar email" (abre mailto)
- "Central de ajuda" (link externo)

Design: bolha flutuante, sem IA, apenas redirecionamento para canais de suporte.

**Arquivo novo**: `src/components/admin/SupportChatWidget.tsx`
**Editar**: `RestaurantAdmin.tsx` (adicionar o widget)

---

### 7. Nova aba "Visao Geral" como primeira aba

**Solucao:** Criar componente `OverviewTab.tsx` — dashboard com cards de resumo:
- Vendas do dia (total e quantidade de pedidos)
- Pedidos pendentes / em preparo
- Faturamento do mes
- Ticket medio
- Mesas ocupadas vs total
- Graficos simples de vendas por hora (hoje)

Sera a aba padrao ao abrir o admin (substituir o `default` no `renderContent()`).

**Arquivo novo**: `src/components/admin/OverviewTab.tsx`
**Editar**: `AppSidebar.tsx` (adicionar item "Visao Geral" no topo), `RestaurantAdmin.tsx` (case "visao-geral", mudar default)

---

### Resumo de arquivos

| Acao | Arquivo |
|---|---|
| Criar | `src/components/admin/OverviewTab.tsx` |
| Criar | `src/components/admin/SupportChatWidget.tsx` |
| Editar | `src/components/admin/TableDetailDialog.tsx` |
| Editar | `src/components/admin/UnifiedOrdersTab.tsx` |
| Editar | `src/components/admin/OrderDetailModal.tsx` |
| Editar | `src/components/admin/PDVTab.tsx` |
| Editar | `src/components/admin/AppSidebar.tsx` |
| Editar | `src/pages/RestaurantAdmin.tsx` |
| Editar | Multiplos arquivos admin (remocao de emojis) |

