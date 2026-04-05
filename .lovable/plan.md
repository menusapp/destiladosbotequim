

# Plan: Corrigir agrupamento de complementos no menu + detalhes no drawer do caixa

## Problema 1 — Complementos no menu sem agrupamento por categoria

### Diagnóstico
O `ProductDetailDrawer` **já tem** a lógica de agrupamento por `extra_category_name`. A query em `Menu.tsx` e `DeliveryMenu.tsx` **já faz** o join com `extra_categories(name)`. O código parece correto.

A causa provável é que os `product_extras` criados pelo sync do `ComplementosTab` não estão retornando o join corretamente, ou os dados antigos têm `extra_category_id` nulo. Para garantir que funcione:

1. Adicionar `console.log` temporário na query de extras para depurar os dados retornados
2. Verificar via query no banco se os `product_extras` realmente têm `extra_category_id` preenchido
3. Se o join funciona mas o nome não vem, pode ser um problema de PostgREST cache ou tipagem

**Ação concreta**: Executar query de diagnóstico no banco para verificar dados. Se os dados estão corretos, o problema pode estar no componente de renderização que o usuário está vendo (talvez Kiosk ou outro componente). Se os dados estão incorretos, rodar reparo.

### Arquivo: `src/pages/Menu.tsx` e `src/pages/DeliveryMenu.tsx`
- Nenhuma mudança de código necessária — a lógica já está correta
- Executar query de diagnóstico: `SELECT pe.id, pe.name, pe.extra_category_id, ec.name as cat_name FROM product_extras pe LEFT JOIN extra_categories ec ON pe.extra_category_id = ec.id WHERE pe.extra_category_id IS NOT NULL LIMIT 20`
- Se `extra_category_id` estiver null nos dados, rodar migração de reparo

### Arquivo: `src/components/menu/ProductDetailDialog.tsx`
- Este componente (Dialog, não Drawer) NÃO tem agrupamento por categoria — renderiza tudo sob "Adicionais"
- Embora não esteja sendo usado pelos menus principais (Menu.tsx usa ProductDetailDrawer), pode estar sendo importado em algum outro lugar
- Adicionar agrupamento por `extra_category_name` neste componente também, para consistência

## Problema 2 — Detalhes do pedido não aparecem no drawer do caixa

### Causa raiz encontrada
Em `PaymentConfirmationModal.tsx` (linhas 319-331), ao inserir `cash_movements`, o campo `bill_id` **nunca é incluído**. O `CashMovementDetailSheet` depende de `movement.bill_id` para buscar o pedido associado. Como é sempre null, o sheet mostra apenas os campos básicos do movimento (responsável, descrição, categoria, pagamento, valor).

### Arquivo: `src/components/admin/PaymentConfirmationModal.tsx`
1. Após criar/atualizar o bill (linhas 271-284), capturar o `bill_id` resultante
2. Para insert: usar `.select("id").single()` para obter o ID do bill recém-criado
3. Para update: já temos `existingBills.id`
4. Passar o `bill_id` capturado para cada `cash_movements.insert` na linha 321

```text
Fluxo corrigido:
  1. Insert/update bill → capturar billId
  2. Insert cash_movement com bill_id: billId
```

### Arquivo: `src/components/admin/PDVTab.tsx` e `src/components/admin/TableDetailDialog.tsx`
- Verificar se esses arquivos também criam cash_movements sem bill_id
- Se sim, aplicar a mesma correção

### Nenhuma alteração em:
- Schema do banco (bill_id já existe na tabela cash_movements)
- CashMovementDetailSheet (já tem a lógica de exibição correta, só faltam os dados)
- Fluxos de delivery, fiscal, iFood
- Lógica de pagamento ou cálculo de valores

## Resumo de mudanças

| Arquivo | Mudança |
|---------|---------|
| `PaymentConfirmationModal.tsx` | Capturar bill_id e incluir no insert de cash_movements |
| `PDVTab.tsx` | Verificar e corrigir bill_id em cash_movements (se aplicável) |
| `TableDetailDialog.tsx` | Verificar e corrigir bill_id em cash_movements (se aplicável) |
| `ProductDetailDialog.tsx` | Adicionar agrupamento por categoria (consistência) |
| Banco de dados | Query de diagnóstico para verificar extra_category_id nos product_extras |

## Ordem de execução
1. Diagnóstico no banco (query para verificar dados de extras)
2. Corrigir `PaymentConfirmationModal.tsx` (bill_id)
3. Verificar e corrigir PDVTab/TableDetailDialog
4. Atualizar `ProductDetailDialog.tsx` com agrupamento
5. Se dados estão quebrados, migração de reparo para extra_category_id

