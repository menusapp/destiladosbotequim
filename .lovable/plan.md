

## Plano: Adicionar setas de ordenação nas categorias

### O que muda

**Arquivo: `src/components/admin/CategoriesTab.tsx`**

1. Adicionar botões de seta (ChevronUp / ChevronDown) em cada categoria, ao lado dos botões existentes (switch, editar, excluir)
2. Primeira categoria: seta pra cima desabilitada. Última: seta pra baixo desabilitada
3. Ao clicar, trocar o `display_order` entre as duas categorias adjacentes no banco e recarregar a lista
4. Funciona mesmo com restaurante aberto (reordenar não altera cardápio estruturalmente)

### Lógica

```
handleMoveCategory(index, direction):
  targetIndex = index + direction (-1 ou +1)
  swap display_order entre categories[index] e categories[targetIndex]
  2x update no supabase
  fetchCategories()
```

### Visual

Cada card de categoria terá, antes dos botões existentes:
```
[↑] [↓]  [switch] [✏️] [🗑️]
```

Setas pequenas (`size="sm"`, `variant="ghost"`) para não poluir a interface.

