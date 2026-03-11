

## Plano: Unificar Pagina de Pedidos com Tabs (Todos, Delivery, Mesas, Retirada, Local)

Este e um projeto grande. Vou dividir em fases para nao quebrar nada.

---

### Estrutura Final da Aba "Pedidos" (unica no sidebar)

**Header**: Titulo "Pedidos" + Search bar (nome/telefone/CPF/codigo) + Filtro de data + Botao "Impressao automatica" + Botao "+ Criar Pedido"

**Tabs horizontais**:
1. **Todos** -- Mostra todos os pedidos (delivery + local + retirada) no formato Kanban
2. **Delivery** -- Kanban filtrado por `order_type=delivery` e `delivery_type=delivery`
3. **Mesas** -- Grid de mesas do restaurante (como TablesTab simplificado). Clicar numa mesa abre um **Sheet lateral** mostrando pedidos/comandas daquela mesa (nao abre pagina nova)
4. **Retirada** -- Kanban filtrado por `order_type=delivery` e `delivery_type=pickup`
5. **Local** -- Kanban filtrado por `order_type=local` ou `null` (pedidos feitos pelo cardapio digital na mesa). Colunas: Aguardando → Preparando → Entregue (pula "saiu para entrega"). Abaixo ou em secao separada: Comandas solicitadas

**Comandas**: Na aba Local, abaixo do kanban, secao "Comandas" mostrando bills com status `requested` / `on_the_way` / `paid`. Com nota: "Para pagar, use PDV". Essa secao so aparece se o dono ativar a opcao "Permitir pedir conta pelo cardapio" nas configuracoes.

---

### Drawer "Criar Pedido" (Sheet right, largura grande)

Reutiliza logica do BalcaoTab existente. Layout dividido:
- **Esquerda**: Formulario com tabs (Delivery / Mesa / Retirada)
  - Delivery: cliente (auto-search), telefone, endereco (CEP auto-preenche via ViaCEP), obs, detalhes conta (acrescimo/desconto), metodo pagamento (misto tambem)
  - Mesa: nome cliente, campo mesa (dropdown opcional das mesas criadas), campo comanda (se necessario), detalhes conta, metodos pagamento
  - Retirada: nome cliente (auto-search), obs, detalhes conta, metodos pagamento
- **Direita**: Grid de produtos com search bar. Clicar abre PDVProductDrawer para complementos/quantidade/obs

---

### Configuracao "Permitir pedir conta pelo cardapio"

Nova coluna `bill_request_enabled` (boolean, default true) na tabela `restaurants`. Toggle em Configuracoes ou Modulos. Quando desativado, o botao "Pedir conta" nao aparece no Menu.tsx/Comanda.tsx do cliente.

---

### Pedidos "em aberto" (PDV manual)

Os pedidos criados pelo drawer com tipo Mesa ficam com `status=pending` e podem ser avancados no kanban normalmente. Quando o cliente terminar de comer, o admin muda para `delivered` e depois usa o PDV para registrar o pagamento. O pedido fica visivel na aba Local ate ser marcado como entregue/pago.

---

### Arquivos

**Criar:**
- `src/components/admin/UnifiedOrdersTab.tsx` -- Componente principal com header, search, tabs, kanban
- `src/components/admin/CreateOrderDrawer.tsx` -- Sheet lateral para criar pedido
- `src/components/admin/TableOrdersDrawer.tsx` -- Sheet lateral que abre ao clicar numa mesa na aba Mesas

**Modificar:**
- `src/components/admin/AppSidebar.tsx` -- Substituir `pedidos-online` + `pedidos-locais` por um unico item `pedidos` com badge combinado
- `src/pages/RestaurantAdmin.tsx` -- Substituir os 2 cases por 1 (`pedidos` → `UnifiedOrdersTab`). Ajustar `handleViewOrder` e `handleViewBill` para navegar para `pedidos`. Ajustar notification badges
- `src/pages/Menu.tsx` -- Condicionar botao "Pedir conta" ao campo `bill_request_enabled`
- `src/pages/Comanda.tsx` -- Mesma condicional

**Manter/Reutilizar:**
- `OrderDetailModal.tsx` -- Abre ao clicar num card do kanban (ja funciona para todos os tipos)
- `PDVProductDrawer.tsx` -- Reutilizado no CreateOrderDrawer
- `CustomerSelectDialog.tsx` -- Reutilizado no CreateOrderDrawer
- `printOrder.ts` -- Impressao unificada

**Migration SQL:**
- Adicionar coluna `bill_request_enabled boolean default true` na tabela `restaurants`

---

### Kanban Unificado (colunas)

| Coluna | Status DB | Icone |
|---|---|---|
| Aguardando | `pending` | Clock |
| Preparando | `accepted`, `preparing` | Utensils |
| Saiu / Pronto | `out_for_delivery`, `ready` (so delivery/retirada) | Truck |
| Entregue | `delivered`, `picked_up` | Check |
| Cancelado | `cancelled` | XCircle |

Na aba **Local**, a coluna "Saiu / Pronto" e omitida -- vai direto de Preparando para Entregue.

---

### Aba Mesas (dentro de Pedidos)

Grid visual das mesas (cards numerados). Cores:
- Verde = ocupada (tem pedidos/comandas ativos)
- Cinza = livre

Clicar abre `TableOrdersDrawer` com:
- Info da mesa (numero, clientes ativos)
- Lista de pedidos ativos dessa mesa
- Lista de comandas dessa mesa
- Botoes de acao rapida (aceitar pedido, etc)

Baseado na imagem de referencia: layout clean, drawer lateral direito.

---

### Impacto nas Funcionalidades Existentes

- **PDV**: Nao muda. Continua como aba separada no sidebar
- **Notificacoes**: `handleViewOrder` e `handleViewBill` apontam para `pedidos` (aba unica)
- **Impressao**: Continua usando `printOrder.ts`
- **WhatsApp**: Continua funcionando via `OrderDetailModal`
- **Realtime**: O `UnifiedOrdersTab` tera um unico listener para orders + bills

