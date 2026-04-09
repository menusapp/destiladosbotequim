
# Crédito de Funcionário — Método de pagamento + Gestão de créditos

## Resumo
Criar tabela `employee_credits`, adicionar "Crédito de Funcionário" como opção de pagamento no PDV, criar sub-aba de gestão de créditos nos Relatórios, e integrar nos relatórios financeiros (Overview, DRE, Caixa).

## 1. Migration — Tabela `employee_credits`

```sql
CREATE TABLE employee_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  employee_name text NOT NULL,
  employee_id text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  due_date date,
  paid_at timestamptz,
  paid_amount numeric(10,2),
  paid_method text,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX idx_employee_credits_restaurant ON employee_credits(restaurant_id);
CREATE INDEX idx_employee_credits_status ON employee_credits(restaurant_id, status);

ALTER TABLE employee_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON employee_credits FOR ALL TO anon USING (true) WITH CHECK (true);
```

RLS usa `anon` com `USING(true)` porque o sistema opera sem sessão Supabase Auth (padrão do projeto).

## 2. PDVTab — Adicionar "Crédito de Funcionário" como método

No select de pagamento (linha ~1176), adicionar:
```tsx
<SelectItem value="employee_credit">Crédito de Funcionário</SelectItem>
```

Quando `paymentType === "employee_credit"`, exibir:
- Input "Nome do Funcionário" com autocomplete (busca nomes distintos de `employee_credits` do restaurante)
- Input "Observação" (opcional)
- Aviso âmbar: "Este pedido será lançado como crédito pendente."

Novos estados: `employeeCreditName`, `employeeCreditNotes`.

No `handleSubmit`, após criar o pedido com `payment_type: 'employee_credit'`, inserir registro em `employee_credits`:
```ts
if (paymentType === "employee_credit") {
  await supabase.from("employee_credits").insert({
    restaurant_id: restaurantId,
    employee_name: employeeCreditName || customerName,
    order_id: order.id,
    amount: finalTotal,
    status: "pending",
    notes: employeeCreditNotes || null,
    created_by: "Sistema PDV",
  });
}
```

## 3. Relatórios — Integração nos métodos de pagamento

### useOrderMetrics.ts
Na função `normalizeMethod`, adicionar:
```ts
if (method === "employee_credit") return "Crédito Funcionário";
```

### OverviewTab.tsx
Na função `getMethodColor`, adicionar:
```ts
if (method === "Crédito Funcionário") return "bg-orange-500";
```

### ReportsTab.tsx
No `paymentTotals` e `METHOD_TYPE_LABELS`, adicionar:
```ts
employee_credit: 0,
// ...
employee_credit: "Crédito de Funcionário",
```
Na função `normalizeMethod`, reconhecer `employee_credit`.

## 4. Caixa — Identificação visual

No `FluxoCaixaTab.tsx`, os movimentos de `employee_credit` entram no caixa normalmente via trigger (delivery) ou modal (local). No resumo de fechamento do caixa, adicionar uma linha separada que soma movimentos com `payment_method` contendo `employee_credit`, com nota visual: "Não está fisicamente no caixa".

Calcular a partir dos `movements` filtrados:
```ts
const employeeCreditTotal = movements
  .filter(m => m.movement_type === "entrada" && m.payment_method?.includes("employee_credit"))
  .reduce((sum, m) => sum + m.amount, 0);
```

Exibir no resumo antes do saldo esperado:
```
Crédito de Funcionário: R$ X,XX (não está no caixa físico)
```

## 5. Sub-aba "Créditos de Funcionários" nos Relatórios

Criar `src/components/admin/EmployeeCreditsTab.tsx`:

- **Totalizadores**: Total Pendente (vermelho), Total Pago (verde), Nº funcionários com crédito aberto
- **Filtros**: status (todos/pendente/pago/cancelado), nome do funcionário, período
- **Tabela**: Funcionário, Data, Pedido (link), Valor, Vencimento, Status (badge)
- **Ações**: "Marcar como Pago" → Dialog com valor pago, método de quitação, data. "Cancelar" com confirmação.

Registrar no `ReportsTab.tsx` como sub-aba usando `Tabs`:
```tsx
<TabsTrigger value="dre">DRE</TabsTrigger>
<TabsTrigger value="employee_credits">Créditos Funcionários</TabsTrigger>
```

## 6. Limpar estados no `clearForm`

Resetar `employeeCreditName` e `employeeCreditNotes`.

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar tabela `employee_credits` |
| `src/components/admin/PDVTab.tsx` | Adicionar opção + campos + insert no submit |
| `src/hooks/useOrderMetrics.ts` | Normalizar `employee_credit` |
| `src/components/admin/OverviewTab.tsx` | Cor para "Crédito Funcionário" |
| `src/components/admin/ReportsTab.tsx` | Normalizar + sub-aba |
| `src/components/admin/FluxoCaixaTab.tsx` | Linha separada no resumo |
| `src/components/admin/EmployeeCreditsTab.tsx` | **Novo** — gestão completa |

## O que NÃO muda
- Fluxo iFood, Delivery Direto, fiscal, NFC-e
- Triggers de caixa existentes (funcionam com qualquer `payment_type`)
- CreateOrderDrawer, PaymentConfirmationModal
- Tabelas existentes (orders, bills, cash_movements)
