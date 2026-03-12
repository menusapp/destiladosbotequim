

## Plano: 4 Melhorias na Gestão de Pedidos e Mesas

---

### 1. PDVProductDrawer: Abrir como Sheet lateral (não Drawer de baixo)

**Problema**: Ao adicionar itens a um pedido via `AddItemsToOrderDrawer`, clicar num produto abre o `PDVProductDrawer` como Drawer (sobe de baixo, toma a tela).

**Solução**: Converter `PDVProductDrawer` de `Drawer`/`DrawerContent` para `Sheet`/`SheetContent` com `side="right"`, mantendo toda a lógica interna (extras, quantidade, observações).

**Arquivo**: `src/components/admin/PDVProductDrawer.tsx`
- Trocar imports de `Drawer`/`DrawerContent` para `Sheet`/`SheetContent`
- Usar `<Sheet open={open} onOpenChange={onClose}>` e `<SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">`
- Manter todo o conteúdo interno (header com imagem, extras, quantidade, botão adicionar)

---

### 2. Remover campo manual de "Taxa do garçom" no PaymentConfirmationModal

**Problema**: O modal de finalizar atendimento (`PaymentConfirmationModal`) tem um campo onde o usuário digita manualmente a % da taxa. Deveria usar a configuração do restaurante automaticamente.

**Solução**: No `PaymentConfirmationModal`:
- Buscar `service_fee_enabled` e `service_fee_percentage` do restaurante ao abrir
- Se `service_fee_enabled === true`: aplicar automaticamente a porcentagem configurada, sem campo editável. Mostrar apenas uma linha informativa "Taxa de serviço (10%): R$ X.XX"
- Se `service_fee_enabled === false`: taxa = 0, sem exibir nada
- Remover o `<Card>` inteiro da "Taxa do garçom" com o `<Input>` de porcentagem

**Arquivo**: `src/components/admin/PaymentConfirmationModal.tsx`

---

### 3. Separar "Mesas e Reservas" — Mesas ficam nos Pedidos, Reservas ficam na aba separada

**Problema**: Existe duplicação: mesas aparecem tanto em "Pedidos > aba Mesas" quanto em "Mesas e Reservas". 

**Solução**:
- **Sidebar** (`AppSidebar.tsx`): Renomear "Mesas e Reservas" para "Reservas" (id permanece `mesas-reservas` ou muda para `reservas`)
- **TablesTab** (`TablesTab.tsx`): Remover toda a parte de gestão de mesas (CRUD, QR code, grid). Manter **apenas** a parte de Reservas. Se reservas desativadas, mostrar tela vazia com botão para ativar
- **UnifiedOrdersTab** (`UnifiedOrdersTab.tsx`): A aba "Mesas" já existe e mostra o grid. Mantém como está

**Arquivos**: `src/components/admin/AppSidebar.tsx`, `src/components/admin/TablesTab.tsx`, `src/pages/RestaurantAdmin.tsx`

---

### 4. Reorganizar abas de Pedidos e colunas do Kanban

**Problema**: Abas atuais são "Todos, Delivery, Mesas, Retirada, Local". Devem ser simplificadas.

**Solução** em `UnifiedOrdersTab.tsx`:

**Abas**: `Delivery` | `Local` (remover "Todos", "Retirada", mover retirada para dentro de Delivery)

**Kanban Delivery** (inclui delivery + retirada):
- Aguardando (pending)
- Preparando (accepted/preparing)
- Saiu / Pronto (out_for_delivery/ready)
- Entregue / Retirado (delivered/picked_up)
- Cancelado (cancelled)

**Kanban Local** (mesa/local):
- Aguardando Confirmação (pending)
- Preparando (accepted/preparing)
- Na Mesa (delivered/picked_up) — novo status visual para pedidos locais entregues à mesa
- Finalizado — pedidos com pagamento confirmado (status delivered + payment_type definido)
- Cancelado (cancelled)

Manter a aba "Mesas" (grid de mesas) e a coluna de "Contas" na aba Local.

**Regra de pagamento** em `OrderDetailModal.tsx`:
- **Delivery**: Bloquear "Entregue/Retirado" sem pagamento (já funciona assim)
- **Local**: Permitir ir até "Na Mesa" sem pagamento. Bloquear "Finalizado" sem pagamento
  - Ajustar `requiresPaymentForFinalization` para verificar: se `order_type === "local"`, bloquear apenas no status final (finalizado), não no "Na Mesa" (delivered)
  - Mudar os botões de ação: para pedidos locais, após preparando, botão "Na Mesa" (sem exigir pagamento). Depois de "Na Mesa", botão "Finalizar" (exige pagamento)

**Arquivos**: `src/components/admin/UnifiedOrdersTab.tsx`, `src/components/admin/OrderDetailModal.tsx`

---

### Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| `PDVProductDrawer.tsx` | Drawer → Sheet lateral |
| `PaymentConfirmationModal.tsx` | Remover campo manual de taxa, auto-aplicar config |
| `AppSidebar.tsx` | Renomear "Mesas e Reservas" → "Reservas" |
| `TablesTab.tsx` | Manter apenas Reservas, remover gestão de mesas |
| `RestaurantAdmin.tsx` | Ajustar referências |
| `UnifiedOrdersTab.tsx` | Abas Delivery/Local, novos Kanbans |
| `OrderDetailModal.tsx` | Lógica de pagamento diferenciada por tipo |

