

## Exclusão em Massa — Cardápio (Produtos) e Estoque (Insumos)

### O que será feito
Adicionar um botão pequeno "Excluir em massa" ao lado da barra de busca em ambas as telas (ProductsGrid e StockItemsGrid). Ao clicar, abre um Dialog com:
- Lista de todos os itens agrupados por categoria
- Checkbox em cada item + "selecionar todos" por categoria
- Contador de selecionados
- Botão "Excluir selecionados" com confirmação

### Componentes

**1. Novo componente: `BulkDeleteProductsDialog.tsx`**
- Recebe `restaurantId`, `open`, `onOpenChange`, `onDeleted`
- Busca produtos agrupados por categoria
- Checkbox por produto + "selecionar categoria inteira"
- Barra de busca interna para filtrar
- Ao confirmar, chama `admin_delete_product` em loop para cada ID selecionado
- Respeita a regra de restaurante aberto (bloqueia se `isRestaurantOpen`)

**2. Novo componente: `BulkDeleteStockDialog.tsx`**
- Mesma estrutura, busca insumos agrupados por `stock_categories`
- Usa `admin_delete_stock_item` RPC para cada item

**3. Alteração em `ProductsGrid.tsx`**
- Adicionar botão `Trash2` pequeno (variant="outline", size="icon") ao lado do botão "Novo Produto"
- Abre `BulkDeleteProductsDialog`

**4. Alteração em `StockItemsGrid.tsx`**
- Mesmo botão ao lado de "Novo Insumo"
- Abre `BulkDeleteStockDialog`

### Detalhes técnicos
- Exclusão sequencial com `Promise.all` limitado ou loop `for...of` para evitar sobrecarga
- ScrollArea com altura fixa no dialog para listas longas
- AlertDialog de confirmação final antes de executar ("Tem certeza que deseja excluir X itens?")
- Após exclusão, chama callback `onDeleted` para refresh da lista principal

### Arquivos
- Criar: `src/components/admin/BulkDeleteProductsDialog.tsx`
- Criar: `src/components/admin/BulkDeleteStockDialog.tsx`
- Editar: `src/components/admin/ProductsGrid.tsx` (adicionar botão + import)
- Editar: `src/components/admin/StockItemsGrid.tsx` (adicionar botão + import)

