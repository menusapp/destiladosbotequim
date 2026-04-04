

# Plan: Vincular produtos na edição de categoria de complementos

## Objetivo
Ao criar ou editar uma categoria de complementos na sub-aba Complementos (Cardápio), exibir uma lista de produtos com checkbox para selecionar quais produtos terão aquela categoria de complementos vinculada — evitando entrar produto por produto.

## Como funciona hoje
- A tabela `product_extras` vincula extras a produtos (campo `product_id` + `extra_category_id`)
- No ProductsTab, o operador clica "Carregar de categoria" para copiar itens de uma `extra_category` como `product_extras` do produto
- Isso é feito produto a produto, o que é trabalhoso

## O que será feito

### Arquivo: `src/components/admin/ComplementosTab.tsx`

**No dialog de criar/editar categoria** (linha ~265-276), adicionar:

1. **Estado para produtos** — buscar todos os produtos do restaurante (via categories → products) e manter lista com checkbox
2. **Estado de seleção** — `selectedProductIds: Set<string>` com os produtos que já possuem extras dessa categoria
3. **Busca** — campo de pesquisa para filtrar produtos na lista (igual ao CategoriesTab)
4. **Pré-seleção ao editar** — ao abrir edição, consultar `product_extras` onde `extra_category_id = categoria.id` e pré-marcar os produtos correspondentes
5. **Ao salvar categoria** — para cada produto selecionado que ainda não tem os extras da categoria, inserir `product_extras` copiando os `extra_category_items` da categoria. Para produtos desmarcados, remover os `product_extras` com `extra_category_id` correspondente

### Lógica de vinculação

```text
Salvar categoria
  ├── Produtos NOVOS selecionados (não tinham extras dessa categoria)
  │     → INSERT product_extras para cada extra_category_item
  │       com extra_category_id = categoria.id
  │
  └── Produtos DESMARCADOS (tinham extras dessa categoria)
        → DELETE product_extras WHERE product_id = X 
          AND extra_category_id = categoria.id
```

### UI no dialog

- Seção "Produtos vinculados" com ScrollArea (max-h-48)
- Campo de busca no topo
- Checkbox + nome do produto
- Contador de produtos selecionados

### Segurança
- Não altera o fluxo existente de "Carregar de categoria" no ProductsTab
- Não altera extras que não possuem `extra_category_id` (extras individuais do produto)
- Não mexe em delivery, fiscal, iFood, DD

