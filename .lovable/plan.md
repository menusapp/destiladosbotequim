

# Sistema de Proteção contra Ações Acidentais — Painel Admin

## Mapeamento de risco encontrado

Após análise das abas (PDV, Mesas, Pedidos, Caixa, Cardápio, Estoque, Clientes, Fiscal, Integrações, Configurações, Backup, Marketing, Fidelidade), identifiquei o estado atual:

**Já protegidos** (AlertDialog em uso):
- Excluir produto, categoria, complemento, programa fidelidade, cliente, fornecedor, mesa
- Limpar Mesa em `TableDetailDialog`
- Desconectar Mercado Pago / Fiscal

**Desprotegidos ou usando `window.confirm()` nativo** (alvo principal):
- 🔴 `PDVTab.handleClearTable` — `confirm()` nativo
- 🔴 `TableDetailView.deleteOrder` / `cancelOrderItem` — `confirm()` nativo
- 🔴 `FluxoCaixaTab` Fechar Caixa — Dialog simples sem aviso de pedidos abertos
- 🔴 `BackupSettings` Restaurar Backup — sem digitação de confirmação
- 🔴 `ContasTab` deletar conta — `window.confirm`
- 🔴 `IntegrationsTab` desconectar MP — `confirm()` nativo
- 🔴 `StockCategoriesTab`, `PaymentMethodsSettings`, `DeliveryZonesSettings`, `CouponsManagement`, `TablesTab`, `ManageTablesDrawer`, `ProductsTab` (excluir produto + categoria extra) — `confirm()` nativo
- 🟡 Cancelar pedido em `UnifiedOrdersTab` / `OrderDetailModal` — sem aviso especial quando `status='preparing'`

## O que vou construir

### 1. Componente reutilizável `ConfirmDialog`

Novo arquivo `src/components/admin/ConfirmDialog.tsx` — wrapper sobre `AlertDialog` com:
- Variantes: `default`, `warning`, `destructive`, `critical` (esta exige digitar `CONFIRMAR`)
- Ícone + título + descrição + consequência específica
- Lista opcional de avisos contextuais (ex.: "3 pedidos em andamento")
- Cooldown de 1.5s no botão de confirmação após clique para impedir duplo-clique
- Botão de ação destrutivo desabilitado enquanto processa (com spinner)

### 2. Hook `useConfirmDialog`

Em `src/hooks/useConfirmDialog.tsx` — API imperativa para chamar de qualquer lugar:
```ts
const confirm = useConfirmDialog();
const ok = await confirm({ variant: 'critical', title: '...', requireTyping: 'CONFIRMAR', warnings: [...] });
if (ok) executeAction();
```
Provider montado uma vez em `RestaurantAdmin.tsx`. Substitui todos os `window.confirm()` sem precisar adicionar JSX em cada componente.

### 3. Helper `useDangerCheck` — verificações contextuais

Em `src/lib/dangerChecks.ts` — funções que retornam avisos antes de uma ação:
- `checkOpenOrdersBeforeCashClose(restaurantId)` → conta pedidos `pending/accepted/preparing`
- `checkUnpaidBeforeTableClear(tableId)` → soma consumo não pago
- `checkOrderInPreparation(order)` → flag se status='preparing'
- `checkProductInActiveOrders(productId)` → bloqueia exclusão se em pedido ativo

### 4. Substituições por componente

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | `handleClearTable` → `confirm()` + `checkUnpaidBeforeTableClear` |
| `TableDetailView.tsx` | `deleteOrder`, `cancelOrderItem` → ConfirmDialog |
| `FluxoCaixaTab.tsx` | Fechar Caixa → adicionar lista de pedidos abertos no Dialog atual + cooldown |
| `BackupSettings.tsx` | Restaurar Backup → variant `critical` (digitar CONFIRMAR) |
| `ContasTab.tsx`, `IntegrationsTab.tsx`, `StockCategoriesTab.tsx`, `PaymentMethodsSettings.tsx`, `DeliveryZonesSettings.tsx`, `CouponsManagement.tsx`, `TablesTab.tsx`, `ManageTablesDrawer.tsx`, `ProductsTab.tsx` | Trocar `window.confirm()` por `await confirm({...})` |
| `UnifiedOrdersTab.tsx` / `OrderDetailModal.tsx` | Cancelar pedido com `status='preparing'` → aviso "já em preparo, pode gerar desperdício" |

### 5. Bloqueio de produto em pedido ativo

`ProductsTab.handleDelete` — antes de excluir, executar `checkProductInActiveOrders`. Se houver, mostrar toast de erro e abortar (bloqueio total, não apenas aviso).

### 6. Cooldown global em `ConfirmDialog`

Não vou refatorar 30 botões de pagamento individualmente — o cooldown vive dentro do `ConfirmDialog`, então qualquer ação que passe por ele já fica protegida contra duplo-clique.

### 7. Padrão visual destrutivo

Auditoria rápida: a maioria dos botões já usa `variant="destructive"` ou `text-destructive`. Vou apenas garantir que botões de "Limpar Mesa", "Cancelar Pedido", "Excluir" no PDVTab e TableDetailView usem o padrão outline-vermelho (não preenchido), reservando o vermelho sólido para o botão final dentro do Dialog.

## O que NÃO vou fazer (por escopo/risco)

- **Sistema de permissões por cargo para ações** (Passo 8) — já existe `staffPermissions.ts` controlando *acesso a abas*, mas adicionar uma camada de "ações restritas dentro da aba" exige nova tabela de granularidade e re-modelagem do RBAC. Vou apenas marcar onde caberia (TODO no código) e perguntar em outra rodada se quer expandir.
- **Empty states bonitos em todas as abas** (Passo 9) — já existem placeholders textuais nas abas principais. Refazer todas com ilustração + CTA é tarefa de UX separada. Posso fazer numa próxima rodada se quiser.
- **Tooltips em todos os ícones** (Passo 6) — varredura em ~40 arquivos. Vou aplicar onde for crítico (botões destrutivos por ícone só), não em todo botão ghost.
- **Não toco em**: lógica de pedido, integrações iFood/DD/Fiscal, cardápio do cliente, edge functions.

## Arquivos criados / modificados

**Criados (3):**
- `src/components/admin/ConfirmDialog.tsx`
- `src/hooks/useConfirmDialog.tsx`
- `src/lib/dangerChecks.ts`

**Modificados (~12):**
- `src/pages/RestaurantAdmin.tsx` (montar provider)
- `src/components/admin/PDVTab.tsx`
- `src/components/admin/TableDetailView.tsx`
- `src/components/admin/FluxoCaixaTab.tsx`
- `src/components/admin/BackupSettings.tsx`
- `src/components/admin/ContasTab.tsx`
- `src/components/admin/IntegrationsTab.tsx`
- `src/components/admin/StockCategoriesTab.tsx`
- `src/components/admin/settings/PaymentMethodsSettings.tsx`
- `src/components/admin/settings/DeliveryZonesSettings.tsx`
- `src/components/admin/CouponsManagement.tsx`
- `src/components/admin/TablesTab.tsx`
- `src/components/admin/ManageTablesDrawer.tsx`
- `src/components/admin/ProductsTab.tsx`
- `src/components/admin/UnifiedOrdersTab.tsx` + `OrderDetailModal.tsx` (aviso pedido em preparo)

## Resultado esperado

Todo `window.confirm()` nativo do painel admin some, substituído por modais visualmente consistentes. Ações irreversíveis críticas (Restaurar Backup, deletar todos produtos via bulk) exigem digitação. Fechar Caixa com pedidos abertos mostra aviso. Cancelar item em preparo avisa sobre desperdício. Duplo-clique em confirmação é impossível (cooldown). Funcionalidade existente preservada — apenas a camada de confirmação muda.

