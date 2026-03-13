

## Plano: Corrigir logout ao pagar múltiplas comandas

### Causa raiz

O erro nos logs é claro: `"new row for relation \"bills\" violates check constraint \"bills_payment_method_check\""`. A bill **não é criada**, logo o listener de realtime nunca dispara, e o cliente **nunca é deslogado**.

O check constraint na tabela `bills` permite apenas: `pix`, `card`, `credit`, `debit`, `cash`, `meal_voucher`, ou `NULL`.

Mas o código em `PaymentConfirmationModal` salva o **nome de exibição** do método (ex: `"Dinheiro"`, `"PIX"`, `"Cartão de Crédito, PIX"`) em vez do **method_type** (ex: `"cash"`, `"pix"`, `"credit"`).

Com 1 login funcionou provavelmente porque o `handleClearTable` cria bills sem `payment_method` (NULL, que passa no check).

### Correção

**Arquivo: `PaymentConfirmationModal.tsx`**

1. Na funcao `addPayment`, armazenar tanto o `name` (para display) quanto o `method_type` (para banco):
   - Mudar `selectedPayments` para guardar `{ method: string, methodType: string, amount: number }`
   - Ao chamar `addPayment`, passar tambem o `method_type` do metodo selecionado

2. No `handleConfirmPayment`:
   - `paymentMethodStr` para o bill: usar `method_type` values (ex: `"cash"`, `"pix"`) — se split com multiplos metodos diferentes, usar apenas o primeiro `method_type` ou `NULL` para evitar violar o check constraint
   - Para `cash_movements`, continuar usando o `name` para display em `description`, mas `method_type` para o campo `payment_method`
   - Para `orders.payment_type`, usar os nomes de exibição (este campo não tem check constraint)

3. Alternativa mais simples: ao inserir o bill, se `paymentMethodStr` contém virgula (split), setar `payment_method: null` em vez de tentar salvar multiplos. Ou salvar apenas o `method_type` do primeiro pagamento.

### Resumo

| Arquivo | Mudança |
|---|---|
| `PaymentConfirmationModal.tsx` | Armazenar `method_type` junto com `name` nos pagamentos; usar `method_type` ao inserir bills e cash_movements; manter `name` apenas para display |

