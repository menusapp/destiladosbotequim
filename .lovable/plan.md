

# Fix: Campos de pagamento Misto não aparecem no PDV

## Diagnóstico

O código do `CreateOrderDrawer.tsx` tem a lógica correta — a seção `{paymentMethod === "mixed" && (...)}` existe (linhas 501-574). Porém, analisando a estrutura do JSX, o bloco de Pagamento (linhas 457-575) está com **indentação incorreta no JSX**, ficando fora do container `space-y-4` do formulário. Isso causa o seguinte:

- O `<div>` do Payment na linha 458 está no mesmo nível do container pai, em vez de dentro dele
- O `overflow-y-auto` do container pai não engloba corretamente a seção de pagamento
- Os campos do misto são renderizados fora da área visível/scrollável

## Correção

### Arquivo: `src/components/admin/CreateOrderDrawer.tsx`

**Reindentação e reestruturação do bloco de pagamento** — mover a seção Payment (linhas 457-575) para dentro do mesmo nível de indentação dos outros campos do formulário (Customer, Address, Notes), garantindo que fique dentro do `<div className="p-4 space-y-4">`.

Adicionalmente, mover o **Cart Summary** (linhas 577-606) para que também fique corretamente dentro do container do formulário.

Sem alteração de lógica — apenas corrigir a estrutura JSX para que os campos do pagamento misto sejam renderizados dentro da área scrollável visível.

