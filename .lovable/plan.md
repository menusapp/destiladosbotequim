

# Plano de Implementação — Filtros de Data, Realtime, Export XMLs e Otimizações

## Resumo

4 blocos de alterações: (1) Fiscal Tab default + Export XMLs funcional, (2) Padronizar TODOS os filtros de data do sistema, (3) Reforçar realtime para multi-PC, (4) Otimizações gerais.

---

## 1. Aba Fiscal — Default "Notas Fiscais" + Export XMLs funcional

**FiscalTab.tsx**
- Alterar `useState("settings")` para `useState("invoices")` — abre direto em Notas Fiscais.

**NotasFiscaisTab.tsx**
- Remover texto "Mês Atual" do botão de exportar XMLs.
- Ao clicar em "Exportar XMLs", abrir um Dialog/Popover com Calendar `mode="range"` para escolher período (de-até).
- Ao confirmar, buscar todas as notas autorizadas no período, baixar os XMLs via `nuvem-fiscal-download` e gerar um arquivo ZIP usando JSZip (já disponível ou será adicionado como dependência).
- Botão com loading state enquanto processa.

**Filtro de data das Notas Fiscais** — será corrigido junto com o item 2.

---

## 2. Padronizar TODOS os filtros de data do sistema

**Padrão unificado:**
- Default ao abrir: dia atual (from = startOfDay(hoje), to = endOfDay(hoje)).
- Calendar `mode="range"` com `locale={ptBR}` e `className="pointer-events-auto"`.
- Primeiro clique = dia inicial, segundo clique = dia final. Se clicar 2x no mesmo dia = filtra só aquele dia.
- Popover fecha automaticamente ao selecionar o segundo dia (range completo).

**Arquivos afetados (6 componentes com filtro de data):**

| Arquivo | Problema atual | Correção |
|---------|---------------|----------|
| `NotasFiscaisTab.tsx` | Default é 1º dia do mês, range bugado | Default hoje, range com auto-close |
| `UnifiedOrdersTab.tsx` | Já usa hoje como default, mas range não fecha sozinho | Adicionar auto-close |
| `NovaEmissaoModal.tsx` | Default 7 dias atrás, range não fecha | Default hoje, auto-close |
| `StockMovementsTab.tsx` | Usa 2 calendários separados (single) | Unificar em 1 calendar range |
| `ReportsTab.tsx` | Usa botões preset + custom range separado | Manter presets mas corrigir custom para range com auto-close |
| `FluxoCaixaTab.tsx` (histórico) | Usa Select com opções fixas (hoje, ontem, 7 dias) | Substituir por Calendar range, default hoje |

**Implementação técnica:**
- Cada filtro usa `useState<{from: Date; to: Date}>` inicializado com hoje.
- `onSelect` do Calendar: quando `range.from` e `range.to` estão definidos, setar o state e fechar o Popover programaticamente (via `open` state controlado).
- Quando o usuário clica no mesmo dia duas vezes, `range.from === range.to`, filtra apenas aquele dia.

---

## 3. Realtime Multi-PC

O sistema já tem realtime configurado nas principais abas (UnifiedOrdersTab, TablesTab, PDVTab, OverviewTab, FluxoCaixaTab, TableDetailDialog, ProductsTab). O que precisa ser reforçado:

**Verificações e melhorias:**

| Componente | Status atual | Melhoria |
|-----------|-------------|----------|
| `UnifiedOrdersTab` | Tem realtime com debounce 400ms | OK — já funciona multi-PC |
| `TablesTab` | Tem realtime | OK |
| `PDVTab` | Tem realtime | OK |
| `OverviewTab` | Tem realtime | OK |
| `NotasFiscaisTab` | SEM realtime | Adicionar channel para `order_fiscal_notes` |
| `StockMovementsTab` | SEM realtime | Adicionar channel para `stock_movements` |
| `FluxoCaixaTab` | Tem realtime | OK |

**Ações:**
- Adicionar realtime subscription em `NotasFiscaisTab` para a tabela `order_fiscal_notes` com debounce.
- Adicionar realtime subscription em `StockMovementsTab` para `stock_movements` com debounce.
- Garantir que `order_fiscal_notes` e `stock_movements` estejam na publicação `supabase_realtime` (via migration SQL).

---

## 4. Otimizações

- **Calendar `pointer-events-auto`**: Adicionar em TODOS os calendários para garantir interatividade dentro de Popovers/Dialogs.
- **Memoização**: Garantir que os filteredOrders e stats em NotasFiscaisTab usem `useMemo`.
- **Debounce consistente**: Todos os realtime listeners com debounce de 400ms para evitar request flooding.
- **Lazy loading**: As abas pesadas (Fiscal, Reports, Stock) já poderiam se beneficiar, mas como já existe React.lazy no sistema, manter consistência.

---

## Arquivos a editar

1. `src/components/admin/FiscalTab.tsx` — default tab
2. `src/components/admin/NotasFiscaisTab.tsx` — date filter, export XMLs, realtime
3. `src/components/admin/UnifiedOrdersTab.tsx` — date filter auto-close
4. `src/components/admin/NovaEmissaoModal.tsx` — date filter default + auto-close
5. `src/components/admin/StockMovementsTab.tsx` — unificar calendar range + realtime
6. `src/components/admin/ReportsTab.tsx` — custom range auto-close
7. `src/components/admin/FluxoCaixaTab.tsx` — histórico date filter para calendar range
8. `package.json` — adicionar `jszip` para export XMLs
9. Migration SQL — habilitar realtime para `order_fiscal_notes` e `stock_movements`

---

## Dependência nova

- `jszip` — para compactar XMLs em .zip no client-side

## Nenhuma funcionalidade existente será quebrada

- Todos os filtros mantêm a mesma lógica de query (gte/lte com ISO dates)
- Apenas a UI do seletor e o valor default mudam
- Realtime é aditivo (não remove nada existente)
- Export XMLs substitui um `toast.info` placeholder por funcionalidade real

