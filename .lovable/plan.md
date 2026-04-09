
# Crédito de Funcionário — Método de pagamento + Gestão de créditos

## Resumo
Criar tabela `employee_credits`, adicionar "Crédito de Funcionário" como opção de pagamento no PDV, criar sub-aba de gestão de créditos nos Relatórios, e integrar nos relatórios financeiros (Overview, DRE, Caixa).

## 1. Migration — Tabela `employee_credits`

Criar tabela com campos: `employee_name`, `employee_id`, `order_id`, `amount`, `status` (pending/paid/cancelled), `notes`, `due_date`, `paid_at`, `paid_amount`, `paid_method`, `created_by`. RLS com política `anon` (padrão do projeto).

## 2. PDVTab — Novo método de pagamento

Adicionar `employee_credit` no select de pagamento. Quando selecionado, exibir:
- Input "Nome do Funcionário" com autocomplete de nomes anteriores
- Input "Observação" (opcional)
- Aviso âmbar sobre crédito pendente

No `handleSubmit`, após criar pedido, inserir registro em `employee_credits` com `status: 'pending'`.

## 3. Relatórios — Reconhecer nas métricas

- `useOrderMetrics.ts`: normalizar `employee_credit` → "Crédito Funcionário"
- `OverviewTab.tsx`: cor laranja para o método
- `ReportsTab.tsx`: adicionar no `paymentTotals` e `normalizeMethod`

## 4. Caixa — Linha separada no fechamento

No resumo do `FluxoCaixaTab`, somar movimentos com `payment_method` = `employee_credit` e exibir em linha separada com nota "não está no caixa físico".

## 5. Nova sub-aba "Créditos de Funcionários"

Criar `EmployeeCreditsTab.tsx` com:
- Totalizadores: Pendente (vermelho), Pago (verde), Nº funcionários
- Filtros: status, nome, período
- Tabela com colunas: Funcionário, Data, Pedido, Valor, Vencimento, Status (badge)
- Ações: "Marcar como Pago" (dialog com valor/método/data) e "Cancelar"

Registrar como sub-aba dentro do `ReportsTab`.

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar tabela `employee_credits` |
| `PDVTab.tsx` | Opção + campos + insert |
| `useOrderMetrics.ts` | Normalizar método |
| `OverviewTab.tsx` | Cor do método |
| `ReportsTab.tsx` | Normalizar + sub-aba |
| `FluxoCaixaTab.tsx` | Linha separada no resumo |
| `EmployeeCreditsTab.tsx` | **Novo** — gestão completa |

## O que NÃO muda
- iFood, Delivery Direto, fiscal, NFC-e
- Triggers de caixa existentes
- CreateOrderDrawer, PaymentConfirmationModal
