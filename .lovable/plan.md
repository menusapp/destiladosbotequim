

# Vincular categorias de complementos corretamente via ComplementosTab

## Problema
Quando você edita uma categoria de complemento e vincula a produtos por ali, o sistema insere registros na tabela `product_extras` (complementos avulsos individuais). O correto é usar a tabela `product_complement_groups`, que é o mesmo mecanismo usado quando se vincula uma categoria pelo editor de produto ("Vincular Categoria de Complementos"). Isso garante que o complemento apareça agrupado por categoria no cardápio, e não como itens soltos.

Além disso, falta controle de ordenação das categorias vinculadas a um produto (subir/descer).

## O que muda

### 1. `ComplementosTab.tsx` — Refatorar vínculo de produtos

**Carregar produtos vinculados** (`openEditCategory`):
- Trocar query de `product_extras` para `product_complement_groups` filtrando por `extra_category_id`
- Carregar os `product_id`s vinculados a partir dessa tabela

**Salvar vínculo** (`handleSaveCategory`):
- Ao adicionar produto: inserir em `product_complement_groups` com `product_id`, `extra_category_id`, `display_order`, `is_required: false`, `min_selection: 0`, `max_selection: null`
- Ao remover produto: deletar da `product_complement_groups` onde `extra_category_id = categoryId AND product_id IN (removidos)`
- **Remover** toda a lógica de `syncCategoryToProducts` e inserção em `product_extras` / `product_extra_ingredients` — não é mais necessário duplicar itens

**Deletar categoria** (`handleDeleteCategory`):
- Adicionar delete de `product_complement_groups` onde `extra_category_id = categoryId` antes de deletar a categoria

### 2. `ProductsGrid.tsx` — Adicionar controle de ordenação

Na seção de "Categorias de Complementos Vinculadas" do editor de produto:
- Exibir botões de seta para cima/baixo em cada grupo vinculado
- Ao reordenar, atualizar o array `linkedGroups` localmente e salvar `display_order` ao submeter
- Já existe `display_order` na tabela `product_complement_groups`
- No `handleSubmit`, ao salvar os grupos, incluir `display_order: index` em cada insert

Na query de carregamento dos grupos (`openEditProduct`), ordenar por `display_order`.

### 3. Queries de cardápio (Menu, DeliveryMenu, Kiosk, PDV)

Verificar que as queries de `product_complement_groups` já usam `.order("display_order")`. Se não, adicionar para respeitar a ordem definida.

### 4. Limpar código legado

- Remover a função `syncCategoryToProducts` inteira
- Os `product_extras` com `extra_category_id` existentes no banco podem ficar (não quebram nada), mas novos vínculos não serão mais criados por ali

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/ComplementosTab.tsx` | Refatorar para usar `product_complement_groups` em vez de `product_extras`; remover `syncCategoryToProducts` |
| `src/components/admin/ProductsGrid.tsx` | Adicionar botões de ordenação (subir/descer) nos grupos vinculados; salvar `display_order` |
| `src/pages/Menu.tsx` | Adicionar `.order("display_order")` na query de `product_complement_groups` se ausente |
| `src/pages/DeliveryMenu.tsx` | Idem |
| `src/pages/Kiosk.tsx` | Idem |
| `src/components/admin/PDVTab.tsx` | Idem |

## O que NÃO muda
- Complementos avulsos individuais (sem categoria) continuam funcionando via `product_extras`
- Variações de produto (insumos variáveis) não são afetadas
- `extra_category_items` e `extra_category_item_ingredients` continuam sendo a fonte dos itens — não há duplicação
- Fiscal, iFood, Delivery Direto, triggers de caixa

