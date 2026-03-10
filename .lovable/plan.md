

## Plano: 3 Melhorias no Sistema

### 1. Seção de Avaliações clicável no Cardápio Digital

**Problema**: As estrelas e contagem de avaliações no `RestaurantInfoCard` são apenas visuais, sem interação.

**Solução**: Criar um componente `ReviewsDrawer` que abre ao clicar nas avaliações. O drawer lista todas as avaliações do restaurante (nome do cliente, estrelas, comentário) buscando da tabela `restaurant_reviews` com join nos pedidos/comandas para pegar o nome do cliente.

**Arquivos**:
- **Criar**: `src/components/menu/ReviewsDrawer.tsx` - Drawer com lista de avaliações (nome, estrelas, comentário, data)
- **Editar**: `src/components/menu/RestaurantInfoCard.tsx` - Tornar a seção de avaliações clicável, abrir o drawer

**Detalhes**: A query buscará `restaurant_reviews` com os campos `rating`, `comment`, `created_at`. Para o nome do cliente, buscaremos via `order_id` -> `orders.customer_name` ou `counter_order_id` -> `counter_orders.customer_name`. Se nenhum nome disponível, exibir "Cliente".

---

### 2. Cor de marcação na aba ativa do Sidebar (admin)

**Problema**: A aba ativa no sidebar usa `bg-accent` que é sutil demais, sem cor forte.

**Solução**: Aplicar cor primária do restaurante (ou laranja padrão) como background da aba ativa no sidebar, com texto branco para contraste.

**Arquivos**:
- **Editar**: `src/components/admin/AppSidebar.tsx` - Mudar estilo da aba ativa para usar cor primária (laranja) como background com texto branco
- **Editar**: `src/pages/RestaurantAdmin.tsx` - Passar `primaryColor` do restaurante para o `AppSidebar`

---

### 3. Corrigir logout do cliente quando garçom paga pelo PDV sem pedido de conta

**Problema**: Em `Menu.tsx`, o listener de bills só escuta `UPDATE`. Quando o garçom paga pelo PDV sem o cliente ter pedido conta, o sistema faz `INSERT` de uma bill já com `status='paid'`. Como não há listener de INSERT para bills em Menu.tsx, o cliente não recebe notificação, não abre avaliação e não desloga.

O `Comanda.tsx` já tem os listeners corretos (UPDATE + INSERT + DELETE), mas `Menu.tsx` só tem UPDATE.

**Solução**: Adicionar listener de `INSERT` na tabela `bills` em Menu.tsx (similar ao que já existe em Comanda.tsx). Quando uma bill é inserida com `status='paid'` e pertence à mesa atual, disparar o mesmo fluxo de avaliação e logout.

**Arquivos**:
- **Editar**: `src/pages/Menu.tsx` - Adicionar `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bills' }, ...)` no canal de realtime existente, verificando se `bill.table_id === currentTableId` e `bill.status === 'paid'`, e então disparar toast + review modal + logout (mesmo fluxo do UPDATE)

