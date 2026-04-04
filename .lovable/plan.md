

# Plan: Corrigir insumos não vinculados ao atribuir categorias de complementos em massa

## Causa raiz

Quando a aba **Complementos** (ou **Categorias**) vincula uma categoria de complementos a múltiplos produtos, ela cria registros em `product_extras` mas **não copia os ingredientes** (`extra_category_item_ingredients`) para `product_extra_ingredients`.

A dedução de estoque (`deduct_stock_for_order_item`) segue o caminho:
```text
order_item_extras → product_extras → product_extra_ingredients → stock_items
```
Como `product_extra_ingredients` está vazio para esses extras, nada é deduzido.

## O que será feito

### Arquivo: `src/components/admin/ComplementosTab.tsx`

Na lógica de "Add newly selected" (linhas 115-128):

1. Buscar `extra_category_items` **com** `extra_category_item_ingredients` (ingredientes)
2. Após inserir cada `product_extras`, buscar os IDs gerados
3. Para cada `product_extra` criado, inserir os `product_extra_ingredients` correspondentes copiando `stock_item_id` e `quantity` da `extra_category_item_ingredients`

```text
Para cada produto novo selecionado:
  Para cada item da categoria:
    → INSERT product_extras (retorna novo ID)
    → Para cada ingrediente do item (extra_category_item_ingredients):
        → INSERT product_extra_ingredients {
            product_extra_id: novo_id,
            stock_item_id: ingrediente.stock_item_id,
            quantity: ingrediente.quantity
          }
```

### Arquivo: `src/components/admin/CategoriesTab.tsx`

Aplicar a mesma correção na lógica de vinculação de produtos que existe nesta aba — também não copia `product_extra_ingredients`.

### Nenhuma alteração em:
- Banco de dados (schema inalterado)
- Fluxo de delivery, iFood, DD, fiscal
- `ProductsTab` (já funciona corretamente via "Carregar de categoria")
- RPC `deduct_stock_for_order_item` (lógica correta, só faltavam os dados)

## Impacto
- Produtos que **já foram vinculados** em massa continuarão sem insumos até serem re-vinculados (desmarcar e marcar novamente)
- Novos vínculos passarão a ter os insumos corretos automaticamente

