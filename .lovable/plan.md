

## Plano: Search Bar de Pedidos Locais no PDV

### O que será feito

Adicionar uma barra de busca acima do grid de mesas no PDV que permite pesquisar pedidos locais/mesa por **nome do cliente**, **CPF** ou **nome do item pedido**. Os resultados aparecem em um dropdown/lista abaixo da barra, mostrando cada pedido correspondente com: nome do cliente, itens resumidos, status e **qual mesa** está associada. Clicar num resultado abre o `TableDetailDialog` daquela mesa.

### Correção no PDVTab.tsx

1. **Novo state**: `orderSearchTerm` (string) para a busca de pedidos (separado do `searchTerm` já existente que é para busca de produtos)

2. **Nova query**: Buscar pedidos locais ativos com dados completos para pesquisa:
   ```
   orders: id, status, customer_name, customer_cpf, table_id, created_at,
     order_items(id, quantity, products(name)),
     tables(table_number, table_name)
   where restaurant_id = X, order_type = 'local',
     status in ['pending','accepted','preparing','ready','delivered']
   ```
   - Reutilizar o realtime já existente para refetch

3. **Filtro client-side** (useMemo): Quando `orderSearchTerm` tiver 2+ caracteres, filtrar pedidos onde:
   - `customer_name` contém o termo (case-insensitive)
   - `customer_cpf` contém o termo
   - Algum `order_items.products.name` contém o termo

4. **UI**: Entre o header do PDV e o grid de mesas, adicionar:
   - Input com ícone Search e placeholder "Buscar pedido por nome, CPF ou item..."
   - Quando há resultados filtrados, mostrar lista de cards compactos abaixo do input:
     - Cada card: `Mesa X • Nome do Cliente • "2x Hambúrguer, 1x Coca..." • Badge status`
     - Click no card → abre `TableDetailDialog` da mesa correspondente
   - Quando busca ativa sem resultados: mensagem "Nenhum pedido encontrado"
   - Quando input vazio: não mostra nada, grid normal

### Arquivo

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | Nova query de pedidos com items/products, state de busca, filtro useMemo, UI da search bar + resultados |

