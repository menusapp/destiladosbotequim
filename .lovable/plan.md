

## Plano: 4 Correções — Complementos no PDV, Limpar Mesa desloga, Pedidos Locais corrigidos

---

### 1. Complementos não aparecem no PDVProductDrawer

**Problema**: A query de produtos no PDV (`pdv-products-create`) busca apenas `product_extras(*)` — ignora completamente os **complementos** vinculados via `product_complement_groups → extra_categories → extra_category_items`.

**Correção no PDVTab.tsx**:
- Após buscar produtos, para cada produto selecionado (ao clicar para abrir o drawer), buscar também `product_complement_groups` com join em `extra_categories(id, name, extra_category_items(id, name, price))` — igual ao que `Menu.tsx` já faz (linhas 896-916)
- Converter complementos para o formato `ProductExtra` com `is_complement: true`
- Passar `product_extras` combinados (diretos + complementos) ao `PDVProductDrawer`

Alternativamente, fazer a busca de complementos diretamente quando o usuário clica num produto (antes de abrir o drawer), igual ao `Menu.tsx`.

**Arquivo**: `PDVTab.tsx` (lógica de click no produto, linhas 536-537)

---

### 2. Limpar Mesa deve deslogar todos os clientes

**Problema**: O `handleClearTable` no `PDVTab` e `TableDetailDialog` fecha comandas (`status: "closed"`), mas o listener em `Comanda.tsx` detecta logout apenas via `bills` com `status='paid'` e `comanda_id`. Fechar comanda sem criar bill paga não aciona o logout.

**Correção no TableDetailDialog.tsx e PDVTab.tsx**:
- No `handleClearTable`, após fechar comandas, **criar bills** com `status: 'paid'` para cada comanda ativa (com `comanda_id`), para que o listener de realtime no `Comanda.tsx` detecte e force logout dos clientes
- Isso garante que o mecanismo existente de logout via bill paga funcione automaticamente

**Arquivos**: `TableDetailDialog.tsx`, `PDVTab.tsx`

---

### 3. Pedidos locais: notificação vai para "Pedidos" em vez de "PDV"

**Problema 1 — Badge laranja na sidebar**: Linha 254 do `RestaurantAdmin.tsx`: quando chega pedido `local`, seta `setHasNewOrders(true)` condicionado a `activeSection !== 'pedidos'` — deveria condicionar a `activeSection !== 'pdv'` para pedidos locais. E o badge deve ir para o item "PDV" na sidebar, não "Pedidos".

**Problema 2 — Badge na mesa**: As mesas no grid do PDV não mostram indicação visual de "Pedido Novo". Precisam de uma tag/badge quando há pedidos `pending` não visualizados naquela mesa.

**Correções**:

A) **RestaurantAdmin.tsx**: 
- Adicionar novo state `hasNewLocalOrders` para pedidos locais
- Quando `orderType === 'local'`, setar `hasNewLocalOrders` (em vez de `hasNewOrders`) condicionado a `activeSection !== 'pdv'`  
- Limpar `hasNewLocalOrders` quando navegar para `pdv`
- Passar `hasNewLocalOrders` para `AppSidebar`

B) **AppSidebar.tsx**:
- Receber prop `hasNewLocalOrders`
- Mostrar badge laranja no item "PDV" quando `hasNewLocalOrders` é true

C) **PDVTab.tsx — Badge "Pedido Novo" nas mesas**:
- Buscar pedidos `pending` com `order_type: 'local'` agrupados por `table_id`
- Nas cards de mesa, mostrar badge "Pedido Novo" quando há pedidos pending naquela mesa
- Mostrar prévia: nome do cliente e contagem de itens na card da mesa (como era antigamente)

**Arquivos**: `RestaurantAdmin.tsx`, `AppSidebar.tsx`, `PDVTab.tsx`

---

### 4. Pedido local criado pelo PDV não chega na mesa

**Problema**: Ao criar pedido tipo "mesa" pelo painel PDV, o pedido é criado com `order_type: "local"` e `table_id` correto, mas os listeners de realtime no `Comanda.tsx` filtram por `comanda_id`. Se a comanda foi criada pelo PDV, o cliente logado na mesa tem uma comanda diferente — então o pedido do PDV não aparece na tela dele.

**Este é o comportamento correto** — o pedido do PDV fica na comanda do PDV, separado da comanda do cliente. O pedido aparece no `TableDetailDialog` quando o admin clica na mesa. Não há bug aqui, apenas a notificação que precisava ir para o PDV (corrigido no item 3).

---

### Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | Buscar complementos ao clicar produto; criar bills ao limpar mesa; mostrar badge "Pedido Novo" + prévia na card da mesa |
| `TableDetailDialog.tsx` | Criar bills com `comanda_id` ao limpar mesa para forçar logout |
| `RestaurantAdmin.tsx` | Separar `hasNewLocalOrders` do `hasNewOrders`; limpar ao ir pro PDV |
| `AppSidebar.tsx` | Receber e mostrar badge no PDV para pedidos locais |

