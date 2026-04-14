

## Plano: Editar Cliente da Comanda (Trocar Cliente)

### O que será feito
Adicionar um ícone de lápis no card do cliente na mesa. Ao clicar, abre o dialog de seleção de cliente (`CustomerSelectDialog`). Ao selecionar outro cliente, o sistema:
1. Atualiza `customer_name` e `customer_cpf` na **comanda**
2. Atualiza `customer_name` e `customer_cpf` em todos os **pedidos** vinculados àquela comanda
3. O CRM reflete automaticamente porque os pedidos passam a ter o CPF do novo cliente

### Mudanças

**`src/components/admin/TableDetailDialog.tsx`**
- Adicionar state `editingComanda` para controlar qual comanda está sendo editada
- No card do cliente (linha ~733), adicionar um botão com ícone `Pencil` ao lado do nome
- Ao clicar, abre o `CustomerSelectDialog` com `restaurantId`
- Ao selecionar novo cliente:
  - `UPDATE comandas SET customer_name, customer_cpf WHERE id = comanda.id`
  - `UPDATE orders SET customer_name, customer_cpf WHERE comanda_id = comanda.id`
  - Refetch dos dados
  - Toast de sucesso

### Layout do card (antes → depois)

```text
Antes:
┌──────────────────────┐
│ 👤 João Silva        │
│    123.456.789-00    │
└──────────────────────┘

Depois:
┌──────────────────────┐
│ 👤 João Silva    ✏️  │
│    123.456.789-00    │
└──────────────────────┘
```

### Arquivo editado
- `src/components/admin/TableDetailDialog.tsx` — adicionar estado, botão de edição e lógica de troca

