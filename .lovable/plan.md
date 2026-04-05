

# Plan: Corrigir sistema de backup e restauração com mapeamento de IDs

## Problema
A restauração usa os IDs originais do backup. Quando o `restaurant_id` é diferente, os `products` são inseridos com `category_id` apontando para categorias do restaurante original, causando falha silenciosa. Além disso, várias tabelas (extra_categories, stock_categories, delivery_zones, etc.) não são restauradas, e não há feedback de progresso.

## Mudanças — arquivo único: `src/components/admin/settings/BackupSettings.tsx`

### 1. Adicionar tabelas faltantes no backup
Incluir em `BACKUP_TABLES_FULL`: `product_variations`, `kiosk_config`, `card_fees_config` (já está), `extra_category_item_ingredients`.

### 2. Reescrever `handleRestore` com mapeamento de IDs

Criar dicionário `idMap: Record<string, string>` global para a restauração. Para cada registro de cada tabela, gerar novo UUID via `crypto.randomUUID()` e mapear `oldId → newId`.

Ordem de inserção respeitando dependências:

| Fase | Tabelas | Foreign keys remapeadas |
|------|---------|------------------------|
| 1 | categories, extra_categories, stock_categories, suppliers | restaurant_id |
| 2 | products, stock_items, tables, payment_methods | category_id, stock_category_id |
| 3 | product_extras, extra_category_items, delivery_zones, product_variations | product_id, extra_category_id, category_id |
| 4 | extra_category_item_ingredients | category_item_id, stock_item_id |
| 5 | loyalty_programs | restaurant_id |
| 6 | loyalty_program_rewards, coupons | program_id, target_product_id |
| 7 | Configs singleton (upsert): business_hours, delivery_config, whatsapp_config, fiscal_configs, kiosk_config, printer_settings, reservation_hours, reservation_tables | restaurant_id |
| 8 | fixed_costs, variable_costs, labor_costs, card_fees_config, customers | restaurant_id |

Para cada registro:
```text
1. newId = crypto.randomUUID()
2. idMap[oldRecord.id] = newId
3. record.id = newId
4. record.restaurant_id = currentRestaurantId
5. record.category_id = idMap[record.category_id] (se existir)
6. ... mesma lógica para cada FK
```

### 3. Adicionar estado de progresso
Novo state `restoreStatus: string` exibido durante a restauração. Atualizado a cada fase: "Restaurando categorias...", "Restaurando produtos...", etc. Exibido no lugar do botão enquanto `restoring === true`.

### 4. Resumo final
Ao concluir, exibir toast com contagem: "Restauração concluída: X categorias, X produtos, X clientes, X mesas importados."

### 5. Tabelas singleton — upsert
Para `delivery_config`, `whatsapp_config`, `fiscal_configs`, `kiosk_config`, `printer_settings`: deletar existente por `restaurant_id` e inserir novo (não há onConflict nativo nessas tabelas, então delete+insert é mais seguro).

## O que NÃO muda
- Lógica de geração do backup (exceto adicionar tabelas faltantes)
- Fluxo de pedidos, fiscal, iFood, Delivery Direto
- Schema do banco — nenhuma migração necessária
- Cloud backup / download de cloud backup

