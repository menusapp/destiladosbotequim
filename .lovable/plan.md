

## Plano: Agrupar produtos por categoria na aba Produtos

### O que muda
Na listagem de produtos do painel admin (`ProductsGrid`), em vez de mostrar todos os produtos numa grade plana, eles serão agrupados por categoria com divisórias visuais. Categorias em ordem alfabética, produtos dentro de cada categoria também em ordem alfabética. Produtos sem categoria aparecem por último numa seção "Sem categoria".

### Alterações técnicas

**Arquivo: `src/components/admin/ProductsGrid.tsx`**

1. **Agrupar `filteredProducts` por categoria** — Criar um `useMemo` que:
   - Ordena as categorias alfabeticamente
   - Agrupa os produtos filtrados pelo `category_id`
   - Dentro de cada grupo, ordena os produtos por nome (A-Z)
   - Coloca produtos com `category_id === null` num grupo "Sem categoria" no final

2. **Alterar a renderização** (linhas ~706-717) — Em vez de um grid plano, iterar pelos grupos:
   - Para cada grupo, renderizar um título (`<h3>` com o nome da categoria)
   - Abaixo do título, o grid de `ProductCard` daquele grupo
   - O grupo "Sem categoria" aparece por último com esse título

3. **Busca continua funcionando** — O filtro de busca já existente filtra os produtos antes do agrupamento, então se uma categoria ficar sem produtos após o filtro, ela simplesmente não aparece.

### Resultado visual
```text
[Buscar produtos...]                    [+ Novo Produto]

── Burger Gourmet ──────────────────────────────────────
[Card] [Card] [Card]

── Combos ──────────────────────────────────────────────
[Card] [Card]

── Sobremesas ──────────────────────────────────────────
[Card]

── Sem categoria ───────────────────────────────────────
[Card] [Card]
```

