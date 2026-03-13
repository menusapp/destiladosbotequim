

## Plano: Reorganizar sidebar por prioridade e agrupar por nicho

### Ordem atual (sem lógica de agrupamento)
Pedidos → PDV → Reservas → Cardápio → Caixa → Estoque → Custos → Margens → Relatórios → Clientes → Fidelidade → Marketing → Fiscal → Módulos → Contas

### Nova ordem proposta (agrupada por nicho, prioridade decrescente)

**Vendas & Operação** (uso diário, maior prioridade):
1. Pedidos
2. PDV
3. Reservas

**Cardápio & Estoque** (gestão de produtos):
4. Cardápio
5. Estoque

**Financeiro** (mesmo nicho agrupado):
6. Caixa
7. Custos
8. Margens
9. Relatórios

**Clientes & Engajamento** (CRM):
10. Clientes
11. Fidelidade
12. Marketing

**Administrativo** (menos frequente):
13. Fiscal
14. Contas (admin only)
15. Módulos

**Configurações** (submenu, sem mudança)

### Implementação

Adicionar separadores visuais (`Separator`) entre os grupos para tornar os nichos visualmente claros.

### Arquivo

| Arquivo | Mudança |
|---|---|
| `AppSidebar.tsx` | Reordenar array `main`, adicionar separadores entre grupos |

