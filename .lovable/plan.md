

## Plano: 3 Melhorias — CRM Layout, Logout ao pagar, Toggle "Pedir Conta"

---

### 1. Melhorar Layout do CRM de Clientes

**ClientesTab.tsx** — Redesign visual:
- Cards de clientes em grid ao invés de tabela (mobile-friendly)
- Cada card com avatar/iniciais, nome, CPF, telefone, badges de pedidos e total gasto
- Manter busca e ordenacao

**CustomerDetailDrawer.tsx** — Transformar em Dialog central (`max-w-3xl`) com layout otimizado:
- Header com avatar grande, nome, CPF formatado, badges de stats (pedidos, total gasto, cliente desde)
- Tabs internas: **Dados** (info editavel + observacoes), **Enderecos** (CRUD completo com visual melhor), **Historico** (pedidos com timeline visual)
- Enderecos em cards com icone de estrela para padrao, botoes de acao mais visiveis
- Historico com timeline, tipo do pedido, status colorido, total

**Arquivos**: `ClientesTab.tsx`, `CustomerDetailDrawer.tsx`

---

### 2. Deslogar cliente ao pagar comanda

**Situacao atual**: `handlePaymentConfirmed` no `TableDetailDialog.tsx` fecha a comanda e marca pedidos como delivered, mas o Comanda.tsx so detecta logout via bill com `status='paid'` e `comanda_id` correspondente.

**Verificacao**: O `PaymentConfirmationModal` ja cria um bill com `status='paid'` e inclui `comanda_id`. O listener em `Comanda.tsx` (linhas ~250-290) ja detecta bills pagas por `comanda_id` e dispara logout. Preciso confirmar que o `comanda_id` esta sendo passado corretamente no `PaymentConfirmationModal` quando chamado pelo `TableDetailDialog`.

**Correcao**: No `TableDetailDialog.handlePaymentConfirmed`, garantir que o `virtualOrder` passado ao `PaymentConfirmationModal` inclua `comanda_id` (nao `_comanda_id`). Atualmente usa `_comanda_id` como campo custom — verificar se o `PaymentConfirmationModal` repassa isso ao criar o bill.

**Arquivos**: `TableDetailDialog.tsx`, possivelmente `PaymentConfirmationModal.tsx`

---

### 3. Toggle "Pedir Conta" com status "A Caminho"

**Situacao atual**: `restaurants.bill_request_enabled` existe na tabela (default `true`) mas NAO e usado no codigo. O botao "Pedir Conta" sempre aparece no Comanda.tsx.

**A) Toggle no painel admin** — `TablesTab.tsx` ou `SettingsTab.tsx`:
- Switch "Permitir clientes solicitarem conta pelo cardapio"
- Salva em `restaurants.bill_request_enabled`

**B) Respeitar config no Comanda.tsx**:
- Buscar `bill_request_enabled` do restaurante no `fetchData`
- Condicionar exibicao do botao "Pedir Conta" a este flag

**C) Notificacao de conta leva ate a mesa**:
- `handleViewBill` em `RestaurantAdmin.tsx` atualmente vai para 'pedidos' — mudar para ir para 'pdv' e abrir o `TableDetailDialog` da mesa correspondente (similar ao auto-abrir mesa por pedido local)
- Passar `billNotification.tableId` para PDVTab

**D) Botao "A Caminho" dentro do TableDetailDialog**:
- Quando existe bill com status `requested` para uma comanda, mostrar badge "Conta Solicitada" e botao "Marcar A Caminho"
- Ao clicar, atualizar bill status para `on_the_way`
- O Comanda.tsx ja detecta `on_the_way` via realtime e mostra ao cliente

**Arquivos**: `Comanda.tsx`, `RestaurantAdmin.tsx`, `TablesTab.tsx`, `TableDetailDialog.tsx`

---

### Resumo de Arquivos

| Arquivo | Mudanca |
|---|---|
| `ClientesTab.tsx` | Redesign visual com cards em grid |
| `CustomerDetailDrawer.tsx` | Transformar em Dialog com tabs (Dados, Enderecos, Historico) |
| `TableDetailDialog.tsx` | Garantir `comanda_id` no pagamento; adicionar badge "Conta Solicitada" + botao "A Caminho" |
| `PaymentConfirmationModal.tsx` | Verificar passagem de `comanda_id` ao criar bill |
| `Comanda.tsx` | Condicionar botao "Pedir Conta" a `bill_request_enabled` |
| `RestaurantAdmin.tsx` | `handleViewBill` redireciona para PDV e abre mesa |
| `TablesTab.tsx` | Switch para ativar/desativar "Pedir Conta" |

