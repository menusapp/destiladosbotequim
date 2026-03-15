

## Plano de Execucao: Refatoracao de 4 Modulos

---

### 1. Visao Geral (Dashboard) — `OverviewTab.tsx`

**Filtro Global de Datas:**
- Adicionar `Select` no topo com options: Hoje, Ultimos 7 dias, Ultimos 30 dias, Este mes, Mes passado, Ultimos 60 dias, Anual
- Estado `dateRange` controla o calculo de `startDate` e `endDate`
- Todas as queries Supabase usam `.gte("created_at", startDate)` e `.lte("created_at", endDate)` em vez do `todayStart`/`monthStart` fixos

**Remocoes:**
- Deletar card "Status das Mesas" (grid de mesas, linhas 279-308)
- Deletar card "Contas Abertas" (debtors, linhas 313-343)
- Remover interfaces `TableData`, `DebtorData` e campos relacionados do state/fetch

**Adicoes — 2 novos cards:**
- **Vendas no Caixa (PDV/Local):** Query `orders` com `order_type = 'local'` + query `counter_orders` com status `paid` no range de datas. Somar totais.
- **Vendas no Delivery:** Query `orders` com `order_type = 'delivery'` nos mesmos filtros de status validos e range de datas.
- Ambos aparecem como MetricCards na grid do topo (substituindo "Clientes Hoje" e "Faturamento Mensal" ou adicionando na linha)

**Reatividade:** O `fetchData` recebe o range de datas calculado. O `useEffect` re-executa quando `dateRange` muda. O grafico de vendas por hora so aparece quando filtro = "Hoje".

---

### 2. Estoque — `StockCard.tsx` + `StockItemsGrid.tsx`

**StockCard.tsx:**
- Reduzir `p-6` para `p-3`
- Nome: `text-lg` → `text-sm font-semibold`
- Valor total: `text-3xl` → `text-xl`
- Grid de metricas: `gap-4` → `gap-2`, `text-sm` → `text-xs`
- Botoes: `h-9` com `text-xs`
- Remover separador visual (border-t)

**StockItemsGrid.tsx:**
- Grid: manter `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` mas reduzir gap de `gap-4` para `gap-2`

Resultado: ~40% mais itens visiveis na mesma tela.

---

### 3. Planos (ex-Modulos) — `ModulosTab.tsx` + `AppSidebar.tsx` + `RestaurantAdmin.tsx`

**Nomenclatura:**
- `AppSidebar.tsx`: label `"Módulos"` → `"Planos"`
- `RestaurantAdmin.tsx`: manter o `id: "modulos"` internamente (evita quebrar routing), mas alterar titulo renderizado
- `ModulosTab.tsx`: header "Escolha seu plano" ja esta correto. Verificar textos internos.

**UI — Remover badge "Recomendado":**
- Deletar linhas 210-216 em `ModulosTab.tsx` (bloco `isRecommended && !isCurrent`)
- Remover variavel `recommendedIndex` e `isRecommended`
- Remover classe `scale-[1.02]` e `border-primary/30 shadow-lg` do card recomendado

---

### 4. Caixa e Historico — `FluxoCaixaTab.tsx` (o mais critico)

**4a. Drill-down nos pedidos (caixa aberto):**
- As linhas de movimentacoes (linhas 749-776) tornam-se clicaveis
- Ao clicar numa movimentacao que tem `bill_id`, buscar o pedido associado via: `orders` WHERE `id` IN (SELECT `order_id` FROM `bill_orders` — ou diretamente `bills.orders`)
- Abrir um Dialog/Sheet "Espelho do Pedido" com:
  - Cliente (`customer_name`, `customer_cpf`)
  - Origem: derivada de `order_type` + `table_id` (ex: "Mesa 05 via QR Code", "Delivery", "Balcao PDV")
  - Endereco (se delivery: `delivery_address`)
  - Forma de pagamento (`payment_method` ou `payment_type`)
  - Produtos com adicionais: `order_items` JOIN `products(name)` + `order_item_extras` JOIN `product_extras(name)`
  - Observacoes (`notes`)
  - Descontos (`coupon_discount`, `loyalty_points_used`, `delivery_fee`)

- Para movimentacoes SEM `bill_id` (manuais), o clique mostra apenas os dados da movimentacao (descricao, valor, responsavel).

- Para movimentacoes com `bill_id`, query:
```sql
SELECT bills.*, 
  orders(*, order_items(*, products(name), order_item_extras(*, product_extras(name))))
FROM bills WHERE id = bill_id
```

**4b. Historico de caixa — mesma funcionalidade:**
- No dialog de caixa fechado (linhas 868-953), as movimentacoes listadas tambem sao clicaveis com o mesmo drill-down

**4c. Searchbar no historico de caixa fechado:**
- Dentro do dialog de detalhes do caixa fechado (linhas 913-948), adicionar um `Input` de busca acima da lista de movimentacoes
- Filtrar `selectedSessionMovements` por `description` ou `created_by` (texto livre)

**Componente novo:** Criar `CashMovementDetailSheet.tsx` — Sheet lateral reutilizavel que recebe `bill_id` ou `movement` e renderiza o espelho do pedido.

---

### Resumo de arquivos

| Acao | Arquivo |
|---|---|
| Editar | `src/components/admin/OverviewTab.tsx` |
| Editar | `src/components/admin/StockCard.tsx` |
| Editar | `src/components/admin/StockItemsGrid.tsx` |
| Editar | `src/components/admin/ModulosTab.tsx` |
| Editar | `src/components/admin/AppSidebar.tsx` |
| Editar | `src/components/admin/FluxoCaixaTab.tsx` |
| Criar | `src/components/admin/CashMovementDetailSheet.tsx` |

Nenhuma migracao de banco necessaria — todos os campos ja existem nas tabelas `orders`, `bills`, `counter_orders`.

