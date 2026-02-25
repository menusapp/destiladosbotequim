

## Plano: Checkout de Cartao com Secure Fields, Cartoes Salvos e Limpeza de Formulario

Este plano abrange 5 acoes: limpeza do formulario, Secure Fields do MP, tabela de cartoes salvos, fluxo de salvar/pagar com cartao salvo no backend, e UI de cartoes salvos.

---

### Acao 1: Limpeza de Formulario e Auto-fill

**Arquivo:** `src/components/menu/checkout/OnlinePaymentStep.tsx`

- Remover os campos: CEP (`cardHolderPostalCode`), N Endereco (`cardHolderAddressNumber`), Telefone (`cardHolderPhone`) e seus estados
- Manter apenas CPF do Titular e E-mail (exigidos pelo MP)
- Auto-preencher CPF e E-mail a partir dos props `customerCPF` e `customerEmail` (ja parcialmente feito)
- Se CPF e Email ja estiverem preenchidos, exibir em modo read-only com badge de "preenchido automaticamente"
- Remover a validacao de CEP/endereco em `handleCreditCardPayment`

---

### Acao 2: Secure Fields (PCI Compliance)

**Arquivo:** `src/components/menu/checkout/OnlinePaymentStep.tsx`

O SDK do MP JS v2 ja esta carregado no `index.html`. Vamos usar os Secure Fields nativos:

- Substituir os `<Input>` de Numero do Cartao, Validade (mes/ano) e CVV por containers `<div>` com IDs unicos
- No `useEffect`, ao entrar no modo credit_card:
  1. Inicializar `new MercadoPago(publicKey)` 
  2. Criar os campos seguros via `mp.fields.create("cardNumber").mount("#card-number-container")`, `mp.fields.create("expirationDate").mount(...)`, `mp.fields.create("securityCode").mount(...)`
  3. Estilizar os campos com o objeto `style` do SDK
- Na hora de tokenizar, usar `mp.fields.createCardToken({ cardholderName, identificationType: "CPF", identificationNumber })` em vez de `mp.createCardToken()` com dados em texto plano
- Remover os estados `cardNumber`, `cardExpiryMonth`, `cardExpiryYear`, `cardCcv` (nao teremos mais acesso a esses dados)
- Para detectar bandeira, usar o evento `binChange` dos Secure Fields

**Resultado:** Os dados sensiveis do cartao nunca tocam nosso DOM/JS, eliminando o aviso de PCI.

---

### Acao 3: Tabela `customer_cards` no Banco de Dados

**Migration SQL:**

```sql
CREATE TABLE public.customer_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  customer_cpf text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  mp_customer_id text NOT NULL,
  card_id text NOT NULL,
  last_four_digits text NOT NULL,
  payment_method_id text NOT NULL,
  first_six_digits text,
  expiration_month integer,
  expiration_year integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, customer_cpf, card_id)
);

ALTER TABLE public.customer_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on customer_cards"
  ON public.customer_cards FOR ALL
  USING (true) WITH CHECK (true);
```

Campos chave:
- `customer_phone` + `customer_cpf`: identificam o cliente (sem auth)
- `mp_customer_id`: ID do Customer criado na API do MP (por restaurante)
- `card_id`: ID do cartao salvo no MP
- `last_four_digits` / `payment_method_id`: para exibir na UI

---

### Acao 4: Backend - Salvar Cartao e Pagar com Cartao Salvo

**Arquivo:** `supabase/functions/mercadopago-charge/index.ts`

Adicionar novos campos no body: `save_card`, `saved_card_id`, `saved_mp_customer_id`

**Fluxo "Salvar Cartao" (`save_card: true`):**
1. Apos o pagamento ser aprovado, verificar se o cliente ja tem `mp_customer_id` na tabela `customer_cards`
2. Se nao tiver, criar Customer via `POST /v1/customers` com email do cliente
3. Salvar o cartao via `POST /v1/customers/{customer_id}/cards` com o `card_token`
4. Inserir registro em `customer_cards` com os dados retornados

**Fluxo "Pagar com Cartao Salvo" (`saved_card_id` presente):**
1. Buscar o `mp_customer_id` e `card_id` da tabela `customer_cards`
2. Enviar pagamento para `/v1/payments` com `payer.id` = Customer ID e `token` = card_id (sem necessidade de tokenizar novamente)

**Novo endpoint auxiliar** (nova Edge Function `mercadopago-cards`):
- `GET` (via body): listar cartoes salvos do cliente (consulta tabela `customer_cards`)
- `DELETE`: remover cartao - chama `DELETE /v1/customers/{customer_id}/cards/{card_id}` e remove da tabela

---

### Acao 5: UI - Lista de Cartoes Salvos

**Arquivo:** `src/components/menu/checkout/OnlinePaymentStep.tsx`

Ao selecionar "Cartao de Credito":

1. Consultar `customer_cards` filtrado por `customer_cpf` + `restaurant_id`
2. Se houver cartoes salvos, exibir:
   - Lista com RadioGroup: cada opcao mostra icone da bandeira (visa/master/elo/amex) + "•••• 4567"
   - Botao de lixeira (Trash2) ao lado de cada cartao para excluir (chama a Edge Function de delete)
   - Botao "+ Usar novo cartao" abaixo da lista
3. Se usuario escolher cartao salvo:
   - Ocultar formulario de Secure Fields
   - No submit, enviar `saved_card_id` e `saved_mp_customer_id` para a Edge Function
4. Se usuario clicar "Novo cartao":
   - Mostrar Secure Fields + checkbox "Salvar cartao para proximas compras"
   - Enviar `save_card: true` no payload se marcado
5. Manter campo Nome no Cartao como input normal (nao e dado sensivel)

---

### Estrutura de Arquivos Modificados

```text
src/components/menu/checkout/OnlinePaymentStep.tsx  -- refatoracao completa do CC
supabase/functions/mercadopago-charge/index.ts       -- save_card + saved_card flows
supabase/functions/mercadopago-cards/index.ts        -- NOVA: delete card
Migration SQL                                        -- tabela customer_cards
```

### Detalhes Tecnicos

- Os Secure Fields do MP usam iframes internos; o estilo e aplicado via objeto JS `{ fontSize: "16px", color: "#333" }` passado no `mount()`
- A deteccao de bandeira via `binChange` substitui a chamada atual ao endpoint `/v1/payment_methods/search` que usa a public key como Bearer (incorreto -- deveria ser access token)
- O card_token gerado pelo Secure Fields e single-use; para cartoes salvos, o MP usa o `card_id` diretamente com o `payer.id`
- O `mp_customer_id` e por restaurante (cada restaurante tem seu access token), entao um mesmo CPF pode ter customer_ids diferentes em restaurantes diferentes

