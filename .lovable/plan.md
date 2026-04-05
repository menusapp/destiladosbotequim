

# Plan: Salvar endereço do pedido delivery no CRM do cliente

## Problema
Quando o operador cria um pedido delivery no PDV com um endereço novo, esse endereço não é salvo na tabela `customer_addresses`. Na próxima vez que o cliente for selecionado, o endereço não aparece.

## Solução
Após o `upsertCustomerCRM()` na função `handleSubmit`, quando o pedido for do tipo `delivery` e houver dados de endereço preenchidos, verificar se já existe um endereço idêntico em `customer_addresses` para aquele CPF. Se não existir, inserir automaticamente.

## Arquivo: `src/components/admin/CreateOrderDrawer.tsx`

1. Criar função `saveAddressToCRM()` que:
   - Verifica se `customerCpf` é válido e se há `deliveryAddress` preenchido
   - Consulta `customer_addresses` para ver se já existe um registro com mesmo `customer_cpf`, `street` e `number`
   - Se não existir, insere um novo registro com os campos: `customer_cpf`, `customer_name`, `customer_phone`, `street`, `number`, `neighborhood`, `city`, `state`, `zip_code`, `is_default: false`
   - Parseia `deliveryCity` (formato "Cidade - UF") para separar city e state

2. Chamar `saveAddressToCRM()` logo após `upsertCustomerCRM()` na linha 278, apenas quando `orderType === "delivery"`

## Nenhuma alteração em:
- Schema do banco (tabela `customer_addresses` já existe com todos os campos necessários)
- `CustomerSelectDialog` (já busca e exibe endereços corretamente)
- Fluxo de pagamento, mesa, retirada
- Lógica de seleção de cliente existente

