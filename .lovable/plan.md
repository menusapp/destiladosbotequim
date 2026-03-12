

## Plano: Reestruturar PDV e Pedidos

### Resumo

**PDV** vira o centro de operações presenciais: grid de mesas + painel lateral sempre visível para criar pedidos (Mesa, Delivery, Retirada, Para Viagem).

**Pedidos** fica simplificado: apenas abas Todos, Delivery e Retirada com Kanban.

---

### 1. Reescrever `PDVTab.tsx`

**Layout**: Split horizontal — esquerda (mesas grid) + direita (painel lateral fixo de criação de pedido).

**Lado Esquerdo — Grid de Mesas**:
- Stats (Total, Ocupadas, Livres) no topo
- Grid de mesas com cards idênticos ao `renderTablesGrid` do UnifiedOrdersTab
- Cada card com dropdown de 3 pontinhos (QR Code, Copiar Link, Limpar Mesa) — reutilizar lógica existente
- Clicar numa mesa abre `TableOrdersDrawer` (ver pedidos, comandas, pagar)
- Botão "Gerenciar Mesas" abre `ManageTablesDrawer`

**Lado Direito — Painel de Criação (sempre visível, não é Sheet)**:
- Idêntico ao conteúdo do `CreateOrderDrawer`, mas renderizado inline (sem Sheet wrapper)
- 4 tipos de pedido via Tabs: **Mesa**, **Delivery**, **Retirada**, **Para Viagem**
  - **Mesa**: seleciona mesa, cliente, CPF, produtos → cria order `order_type: "local"` com comanda
  - **Delivery**: cliente, telefone, CEP/endereço, produtos → cria order `order_type: "delivery"`, `delivery_type: "delivery"`
  - **Retirada**: cliente, CPF, produtos → cria order `order_type: "delivery"`, `delivery_type: "pickup"`
  - **Para Viagem** (NOVO): cliente (opcional), produtos, pagamento → cria order `order_type: "delivery"`, `delivery_type: "takeaway"` (sem mesa, sem endereço)
- Grid de produtos com busca no painel
- Carrinho com resumo e botão "Criar Pedido"
- Ao clicar numa mesa no grid, o tab "Mesa" é auto-selecionado e a mesa é pré-preenchida

**Componentes reutilizados**: `PDVProductDrawer`, `CustomerSelectDialog`, `TableOrdersDrawer`, `ManageTablesDrawer`

O PDV antigo (BalcaoTab, Dialog de detalhes da mesa, Dialog de pagamento) permanece funcional pois a lógica de pagamento continua via `TableOrdersDrawer` e PDV mesas.

---

### 2. Modificar `UnifiedOrdersTab.tsx`

**Remover**: aba "Local" e aba "Mesas" (grid de mesas, TableOrdersDrawer, ManageTablesDrawer)

**Manter**: 
- Aba **Todos** (novo): mostra todos os pedidos em Kanban genérico
- Aba **Delivery**: filtro `order_type === "delivery" && delivery_type === "delivery"`
- Aba **Retirada**: filtro `order_type === "delivery" && delivery_type === "pickup"`

**Ajustes**:
- Remover `CreateOrderDrawer` (criação de pedidos fica só no PDV)
- Remover botão "Criar Pedido" do header
- Remover `ManageTablesDrawer` e lógica de mesas
- Kanban columns: Aguardando, Preparando, Saiu/Pronto, Entregue/Retirado, Cancelado

---

### 3. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/PDVTab.tsx` | Reescrita completa: grid de mesas + painel lateral inline de criação |
| `src/components/admin/UnifiedOrdersTab.tsx` | Remover abas Local/Mesas, adicionar aba Todos, remover CreateOrderDrawer |

### Notas técnicas
- O painel lateral do PDV será um componente inline (div com border-left), não um Sheet/Drawer
- A lógica de criação de pedido será extraída do `CreateOrderDrawer` e adaptada para renderização inline
- "Para Viagem" usa `delivery_type: "takeaway"` para diferenciar de pickup
- O PDV antigo com BalcaoTab será removido, substituído pela nova estrutura

