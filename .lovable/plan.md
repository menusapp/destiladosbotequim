

## Plano: 3 Melhorias — Auto-abrir mesa, Pop-up de mesa completo, CRM com endereços

---

### 1. Auto-abrir mesa quando chega pedido local

**Situação atual**: Quando chega pedido de mesa, `handleViewOrder` em `RestaurantAdmin.tsx` navega para o PDV mas não abre a mesa específica.

**Correção**:
- Em `RestaurantAdmin.tsx`: quando `globalNotification.orderType === 'local'`, passar o `table_id` do pedido para o PDV via novo state (ex: `pendingTableToOpen`)
- Alterar `PDVTab` para aceitar prop `pendingTableToOpen?: string` — quando presente, auto-abrir o dialog da mesa correspondente
- Em `RestaurantAdmin.tsx`, buscar `table_id` do pedido na notificação (já disponível no payload do realtime) e passá-lo junto

**Arquivos**: `RestaurantAdmin.tsx`, `PDVTab.tsx`

---

### 2. Pop-up central da mesa (Dialog em vez de Sheet lateral)

**Situação atual**: Clicar numa mesa abre `TableOrdersDrawer` (Sheet lateral simples, só lista pedidos).

**Novo componente**: `TableDetailDialog.tsx` — Dialog central completo com:

**Layout do Dialog (max-w-4xl)**:
- **Header**: Número da mesa, status (ocupada/livre), tempo ocupada, botão Limpar Mesa
- **Seção "Clientes Logados"**: Lista de comandas ativas com nome e CPF de cada
- **Seção "Pedidos"**: Agrupados por comanda/cliente, cada pedido mostrando:
  - Items, quantidades, preços, extras
  - Status com badge colorido
  - Botão de pagamento individual por comanda (abre `PaymentConfirmationModal`)
- **Total da mesa**: Soma de todos os pedidos ativos
- **Ação "Adicionar Pedido"**: Botão que pre-seleciona a mesa no painel lateral do PDV e fecha o dialog
- **Ação "Pagar Comanda"**: Para cada comanda, botão que abre `PaymentConfirmationModal` com os pedidos daquela comanda

**Mudanças no PDVTab**:
- Substituir `TableOrdersDrawer` por novo `TableDetailDialog`
- `handleTableClick` abre o dialog em vez do drawer
- Manter o drawer importado caso precise em outros lugares

**Arquivos**: Criar `src/components/admin/TableDetailDialog.tsx`, editar `PDVTab.tsx`

---

### 3. CRM de Clientes com endereços + auto-preenchimento no PDV

**Situação atual**: 
- `customer_addresses` table já existe no banco com campos completos (street, number, complement, neighborhood, city, state, zip_code, is_default)
- `CustomerDetailDrawer` já mostra endereços salvos (read-only)
- `ClientesTab` formulário de novo cliente não tem campos de endereço
- `CustomerSelectDialog` retorna só `{id, cpf, name, phone}` — sem endereço
- PDV `handleCustomerSelect` preenche só nome, CPF e telefone

**Correções**:

A) **ClientesTab** — Adicionar campos de endereço no formulário "Novo Cliente":
- Campos: CEP (com busca ViaCEP), Rua, Número, Complemento, Bairro, Cidade, Estado
- Ao salvar cliente, inserir também em `customer_addresses` se endereço preenchido, com `is_default: true`

B) **CustomerDetailDrawer** — Permitir adicionar/editar endereços:
- Botão "Adicionar Endereço" que expande formulário inline
- Marcar endereço como padrão
- Editar/excluir endereços existentes

C) **CustomerSelectDialog** — Ao selecionar cliente, buscar endereço padrão:
- Depois do select, buscar `customer_addresses` where `customer_cpf = cpf AND is_default = true`
- Retornar endereço junto no callback `onSelect`

D) **PDVTab** — Auto-preencher endereço ao selecionar cliente:
- `handleCustomerSelect` recebe endereço do callback
- Se tipo = "delivery" e endereço existe, auto-preencher CEP, Rua, Bairro, Cidade
- Campos ficam editáveis para o operador alterar se necessário

**Arquivos**: `ClientesTab.tsx`, `CustomerDetailDrawer.tsx`, `CustomerSelectDialog.tsx`, `PDVTab.tsx`

---

### Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/RestaurantAdmin.tsx` | Passar `table_id` do pedido local para PDV via prop |
| `src/components/admin/PDVTab.tsx` | Receber `pendingTableToOpen`, usar `TableDetailDialog` em vez de `TableOrdersDrawer`, auto-preencher endereço do cliente |
| `src/components/admin/TableDetailDialog.tsx` | **NOVO** — Dialog central completo da mesa com clientes, pedidos agrupados por comanda, pagamento por comanda, botão adicionar pedido |
| `src/components/admin/ClientesTab.tsx` | Campos de endereço no form "Novo Cliente" |
| `src/components/admin/CustomerDetailDrawer.tsx` | CRUD de endereços (adicionar, editar, excluir, marcar padrão) |
| `src/components/admin/CustomerSelectDialog.tsx` | Buscar e retornar endereço padrão do cliente selecionado |

