

# Botões de Avanço de Status nos Cards de Pedido

## Resumo
Adicionar botões de ação rápida nos cards do kanban para avançar status sem abrir o modal de detalhes. Reutilizar toda a lógica existente do `OrderDetailModal` (iFood sync, DD sync, WhatsApp, auto-print, marketing trigger) extraindo-a para um hook compartilhado.

## Arquitetura

### 1. Criar hook `useOrderStatusAdvance.ts`
Extrair a lógica de `updateStatus` do `OrderDetailModal.tsx` para um hook reutilizável:
- `sendWhatsAppNotification`
- `syncDDStatus` + `syncIfoodStatus`
- `requiresPaymentForFinalization`
- Auto-print ao aceitar
- Marketing trigger ao entregar/retirar
- Mesa ocupada ao aceitar pedido local
- Retorna `{ advanceStatus, isLoading }` — recebe `(orderId, newStatus, order, restaurantId)`

### 2. Lógica de próximo status
Função `getNextStatus(order)` que retorna `{ status, label }`:

| Status atual | Delivery | Retirada/Viagem/Balcão | Mesa (local) |
|---|---|---|---|
| pending | accepted / "Aceitar" | accepted / "Aceitar" | accepted / "Aceitar" |
| accepted | preparing / "Em Preparo" | preparing / "Em Preparo" | preparing / "Em Preparo" |
| preparing | out_for_delivery / "Saiu p/ Entrega" | ready / "Pronto" | ready / "Pronto" |
| ready | — | picked_up / "Retirado" | delivered / "Na Mesa" |
| out_for_delivery | delivered / "Entregue" | — | — |

### 3. Modificar `renderOrderCard` em `UnifiedOrdersTab.tsx`

**Card expandido**:
- `min-h-[180px]` no card
- Mostrar 3 itens (atualmente 2) com quantidade
- Endereço resumido (bairro) para delivery
- Método de pagamento + bandeira

**Rodapé do card** (nova seção abaixo do total):
- Botão primário com label do próximo status + loading state
- `onClick` no botão chama `advanceStatus` do hook (com `e.stopPropagation()` para não abrir o modal)
- Ícone `MoreVertical` ao lado que abre `DropdownMenu` com: "Ver detalhes", "Cancelar pedido", "Imprimir"
- O clique no corpo do card continua abrindo o modal de detalhes

**Auto-print**: Ao clicar "Aceitar" e `autoPrint` estar ativo, disparar `printOrder` automaticamente (já lido do state existente).

### 4. Adaptar `OrderDetailModal.tsx`
- Importar e usar o mesmo hook `useOrderStatusAdvance` em vez da lógica inline
- Manter todo o comportamento atual do modal intacto

## Segurança e estabilidade
- A função RPC `admin_update_order_status` já suporta todas as transições — não precisa de mudança no backend
- Os triggers de banco (estoque, caixa) já disparam automaticamente na mudança de status
- WhatsApp, iFood sync, DD sync e marketing trigger são chamados explicitamente no hook — mesma lógica do modal atual
- Nenhuma migration SQL necessária
- O `e.stopPropagation()` nos botões garante que o clique no card continua funcionando

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useOrderStatusAdvance.ts` | **Novo** — hook com lógica de avanço de status |
| `src/components/admin/UnifiedOrdersTab.tsx` | Cards expandidos + botões de ação rápida no rodapé |
| `src/components/admin/OrderDetailModal.tsx` | Refatorar para usar o hook compartilhado |

## O que NÃO muda
- Backend / RPCs / triggers de banco
- Fluxo de impressão, WhatsApp, iFood, DD
- Layout do modal de detalhes
- Polling de integrações
- Realtime channels

