

## Plano: Gestão de Mesas na seção Mesas dos Pedidos

### Raciocínio

Em sistemas como iFood Gestor, Goomer, Saipos, a gestão de mesas fica junto da operação diária (tela de pedidos/mesas). O operador de caixa não precisa navegar para outra aba para criar ou editar uma mesa. O fluxo mais prático:

- **Aba Pedidos > seção Mesas**: grid de mesas + botão "Gerenciar Mesas" (ícone engrenagem)
- Ao clicar, abre um **drawer/modal** onde o operador pode criar, editar, excluir mesas, definir capacidade, foto, nome
- A aba **Reservas** apenas consome as mesas já criadas (para vincular reservas a mesas)

### O que fazer

**Arquivo**: `src/components/admin/UnifiedOrdersTab.tsx` (seção Mesas)
- Adicionar botão "Gerenciar Mesas" (ícone Settings/Plus) no header da seção Mesas
- Ao clicar, abrir um novo componente de gestão

**Novo arquivo**: `src/components/admin/ManageTablesDrawer.tsx`
- Sheet lateral com lista de mesas existentes
- Para cada mesa: nome, número, capacidade min/max, foto (upload para bucket `table-images`), ações editar/excluir
- Botão "Adicionar Mesa" no topo
- Formulário inline ou dialog para criar/editar: número, nome opcional, capacidade min/max, foto opcional
- CRUD direto na tabela `tables` (já tem RLS aberta)

**Arquivo**: `src/components/admin/TablesTab.tsx` (aba Reservas)
- Manter apenas reservas
- Para vincular mesa a reserva, buscar mesas da tabela `tables` (já existente)

### Resumo

| Arquivo | Mudança |
|---|---|
| `UnifiedOrdersTab.tsx` | Botão "Gerenciar Mesas" na seção Mesas |
| `ManageTablesDrawer.tsx` | Novo componente: CRUD de mesas em Sheet lateral |
| `TablesTab.tsx` | Sem mudança (já foi simplificado para Reservas) |

Nenhuma mudança no banco de dados necessária — a tabela `tables` já tem todos os campos necessários (table_number, table_name, min_capacity, max_capacity, image_url, description).

