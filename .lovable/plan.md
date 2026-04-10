

## Plano: Ativação/Desativação de Insumos com Impacto no Cardápio

### Resumo
Adicionar coluna `is_active` na tabela `stock_items`, toggle na UI de insumos, e filtrar automaticamente produtos/complementos vinculados a insumos inativos em todos os cardápios (Mesas, Delivery, Totem).

---

### 1. Migration — Adicionar `is_active` em `stock_items`

```sql
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
```

### 2. UI do Toggle — `StockCard.tsx` e `StockItemsGrid.tsx`

- Adicionar `is_active` à interface `StockItem`
- Adicionar switch discreto (mesmo padrão usado em categorias/complementos: 16x32px) no `StockCard`
- Toggle faz `UPDATE stock_items SET is_active = !current WHERE id = X`
- Card com opacidade reduzida + badge "Inativo" quando desativado (mesmo padrão visual do sistema)

### 3. Filtro nos cardápios — Lógica compartilhada

Criar hook `useInactiveStockItems(restaurantId)` que:
- Busca `stock_items` onde `is_active = false` para o restaurante
- Busca `product_ingredients` e `extra_category_item_ingredients` vinculados a esses insumos
- Retorna dois Sets: `disabledProductIds` e `disabledExtraCategoryItemIds`
- Cache com `staleTime: 60s`

### 4. Integrar filtro nos 3 cardápios

**Menu.tsx (Mesas):** Após filtrar por `available` e `visibility_channels`, também excluir produtos cujo ID está em `disabledProductIds`. Na abertura de produto, filtrar extras vinculados a insumos inativos.

**DeliveryMenu.tsx:** Mesma lógica.

**Kiosk.tsx:** Mesma lógica — filtrar no `fetchData` e no `openProduct`.

Em todos os casos: complementos afetados são ocultados individualmente (não a categoria inteira).

### 5. Reativação automática

Quando o toggle volta para ativo, o hook retorna Sets atualizados e os produtos/complementos reaparecem automaticamente.

---

### Arquivos
- **Migration**: adicionar `is_active` em `stock_items`
- **Criar**: `src/hooks/useInactiveStockItems.ts`
- **Editar**: `src/components/admin/StockCard.tsx` — toggle + visual
- **Editar**: `src/components/admin/StockItemsGrid.tsx` — interface + toggle handler
- **Editar**: `src/pages/Menu.tsx` — filtro por insumos inativos
- **Editar**: `src/pages/DeliveryMenu.tsx` — filtro por insumos inativos
- **Editar**: `src/pages/Kiosk.tsx` — filtro por insumos inativos

