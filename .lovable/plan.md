

# Refatorar PDVTab — Layout maior + UX de cliente otimizada

## Resumo
Expandir o painel de criação de pedidos, aumentar espaçamento geral, e substituir os campos abertos de cliente/endereço por componentes compactos com botões "Buscar Cliente" e "Criar Novo" (inline colapsável). Para delivery, substituir campos de endereço por componente compacto com estado condicional baseado no cliente selecionado.

## Detalhes Técnicos

### 1. Layout geral — `PDVTab.tsx`

**Painel direito**: expandir de `w-[420px]` para `w-[520px]`.

**Espaçamento**: dentro do `ScrollArea`, mudar `space-y-4` para `space-y-5`, inputs de `h-8` para `h-9`, gaps entre campos de `space-y-2` para `space-y-3`.

### 2. Seção de Cliente (para Mesa, Retirada, Viagem)

Substituir os 3 inputs abertos (CPF, Nome, Celular) + botão "Buscar" por:

- Container `border rounded-lg p-4 bg-muted/30` com título "Cliente"
- Dois botões lado a lado: "Buscar Cliente" (abre `CustomerSelectDialog` existente) e "Criar Novo" (expande formulário inline)
- Quando cliente selecionado: card compacto com nome, telefone e botão X para limpar
- "Criar Novo": expande abaixo (com animação via Collapsible) os 3 campos (CPF, Nome, Celular) + botão "Salvar" que faz upsert no CRM e marca como selecionado

Estado interno: `selectedCustomer: { name, cpf, phone } | null` e `showNewClientForm: boolean`.

Ao selecionar via `CustomerSelectDialog` ou salvar novo cliente: fechar form, preencher `selectedCustomer`, popular os states existentes (`customerName`, `customerCpf`, `customerPhone`) para não quebrar o `handleSubmit`.

### 3. Seção de Endereço (apenas Delivery)

Substituir os 4 inputs abertos (CEP, Rua, Bairro, Cidade) por componente compacto:

- Container `border rounded-lg p-4 bg-muted/30` com título "Endereço de Entrega"
- Sem cliente: texto italic "Selecione um cliente para ver os endereços salvos"
- Com cliente mas sem endereço: border-dashed placeholder
- Com endereço: card compacto mostrando rua, bairro, cidade + taxa de entrega calculada
- Botão "Alterar endereço" que abre um Dialog com:
  - Lista de endereços salvos do cliente (busca `customer_addresses` por CPF)
  - Botão "Novo endereço" que mostra campos CEP, Rua, Número, Complemento, Bairro, Cidade
  - CEP com auto-lookup via ViaCEP (lógica já existente)
  - Ao confirmar: popula os states existentes (`deliveryAddress`, `deliveryNeighborhood`, etc.) e calcula taxa via `delivery_zones`

Auto-fill: quando `handleCustomerSelect` traz `defaultAddress`, já preencher o endereço selecionado automaticamente (lógica existente mantida).

### 4. Novo estado e lógica

Adicionar ao componente:
- `selectedCustomer` state (derivado dos campos existentes)
- `showNewClientForm` boolean
- `showAddressDialog` boolean
- `customerAddresses` query (busca por CPF quando cliente selecionado e orderType = delivery)

Toda lógica de submit (`handleSubmit`, `upsertCustomerCRM`, `insertOrderItems`) permanece inalterada — os states `customerName`, `customerCpf`, `customerPhone`, `deliveryAddress`, etc. continuam sendo a fonte de verdade.

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/PDVTab.tsx` | Refatorar seções de cliente e endereço + expandir layout |

## O que NÃO muda
- `handleSubmit`, `upsertCustomerCRM`, `insertOrderItems` — mesma lógica
- `CustomerSelectDialog` — reutilizado sem alteração
- Mapa de mesas, realtime, busca de pedidos
- `CreateOrderDrawer` — não é afetado (componente separado)
- Backend / RPCs / triggers

