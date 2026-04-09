

# 2 Ajustes: Remover aba "Viagem" + Descontos em Folha no DRE

## 1. Remover TabsTrigger "Viagem" do PDV

Em `PDVTab.tsx`:
- Remover a tab "Viagem" do grid (mudar de `grid-cols-4` para `grid-cols-3`)
- Alterar o tipo de `orderType` de `"mesa" | "delivery" | "retirada" | "viagem"` para `"mesa" | "delivery" | "retirada"`
- Em todo lugar que trata `viagem`, redirecionar para `retirada` (que já usa `delivery_type: "pickup"`) — na prática, o bloco `else if (orderType === "viagem")` no `handleSubmit` pode ser removido porque `retirada` já cobre esse caso
- A lógica de `delivery_type` fica: `delivery` → `"delivery"`, `retirada` → `"pickup"` (sem `"takeaway"`)
- Verificar se `"takeaway"` é usado em outros lugares para não quebrar pedidos antigos — ele continuará sendo reconhecido nos relatórios, apenas não será criado mais pelo PDV

## 2. Adicionar "Descontos em Folha" no DRE

Em `ReportsTab.tsx`:
- Fazer uma query de `employee_credits` com `status = 'paid'` e `paid_method = 'payroll'` no período selecionado
- Somar os `paid_amount` desses registros como `payrollRecovery`
- Adicionar uma nova linha no DRE após "Lucro Bruto" e antes de "Despesas Operacionais":
  - **"(+) Descontos em Folha"** com valor positivo em verde — representando receita recuperada de consumo de funcionários
- Incluir esse valor no cálculo de `operationalProfit`: `totalRevenue - totalCosts + payrollRecovery`
- Atualizar o PDF de exportação para incluir essa linha

### Posição no DRE:
```text
Receita Bruta                    R$ X.XXX,XX
  (-) CMV dos Produtos           R$ X.XXX,XX
Lucro Bruto                      R$ X.XXX,XX
  (+) Descontos em Folha         R$ X.XXX,XX   ← NOVO
  Despesas Operacionais
    Saídas do Caixa              R$ X.XXX,XX
    Custo Fixo                   R$ X.XXX,XX
    ...
Lucro Operacional                R$ X.XXX,XX
```

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | Remover tab "Viagem", limpar lógica associada |
| `ReportsTab.tsx` | Query `employee_credits` payroll + linha no DRE + PDF |

## O que NÃO muda
- Pedidos antigos com `delivery_type = "takeaway"` continuam funcionando nos relatórios
- iFood, Delivery Direto, fiscal, triggers de caixa

