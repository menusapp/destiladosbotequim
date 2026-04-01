

# Corrigir 3 Problemas da Integracao Delivery Direto

## Diagnostico dos Logs

### Problema 1: dd-order-action retorna 404
Os logs mostram que `PUT /admin-api/v1/orders/69572037` retorna **HTML 404** dizendo "loja nao encontrada". A pagina HTML generica do DD indica que esse endpoint **nao existe** nesse formato. A API Admin do DD tem DOIS endpoints de pedidos:
- `GET /admin-api/v1/orders` (lista - funciona)
- `PUT /admin-api/v1/orders/{id}` (status - retorna 404)

Solucao: Usar o endpoint **KDS** do DD que documentado na OpenAPI: `PUT /admin-api/v1/kds/orders/{id}` com body `{ "status": "APPROVED" }` - que serve exatamente para atualizar status de pedidos. Se este tambem falhar, existe tambem o endpoint generico `/admin-api/v1/orders` com PUT.

Adicionalmente, o `dd_order_id` salvo e o `orderNumber` (69572037) que coincide com o `id` nesse caso. Precisamos logar o resultado para confirmar qual ID usar.

### Problema 2: Itens vazios e pagamento generico
O log trunca a resposta em 500 caracteres - mostra apenas ate `total.requiredChange`. Os campos `items`, `payment`, `customer` estao APOS os 500 chars e nunca sao logados.

O codigo busca `ddOrder.items || ddOrder.orderItems` mas o nome do campo real pode ser diferente (ex: `cart`, `orderProducts`, ou estar dentro de outro objeto).

Solucao: 
1. Logar `Object.keys(ddOrder)` para descobrir os nomes exatos dos campos
2. Logar o primeiro pedido completo (ate 3000 chars) para ver items e payment
3. Adicionar fallback para todos os nomes possiveis de campos

### Problema 3: Valores em centavos
O `deliveryFee.value: 300` = R$3,00, mas a logica de divisao por 100 so aplica se `> 100`. Valores como 300 (R$3,00) passam por ser `>100`, mas valores menores (ex: delivery fee de R$0,50 = 50) nao seriam divididos. A logica precisa ser mais robusta - todos os valores `Money` do DD estao em centavos, sem excecao.

---

## Alteracoes

### 1. `supabase/functions/dd-polling/index.ts`

**Logging expandido** (linha 140):
- Mudar de 500 para 3000 caracteres no log da resposta
- Adicionar log dos campos do primeiro pedido: `Object.keys(ordersList[0])` 
- Adicionar log especifico dos items e payment do primeiro pedido

**Nomes de campos para items** (linhas 274-275):
- Adicionar fallbacks: `ddOrder.items || ddOrder.orderItems || ddOrder.cart || ddOrder.products || ddOrder.orderProducts || []`
- Se nenhum campo de items existir, logar warning: `"[dd-polling] No items field found. Order keys: ${Object.keys(ddOrder)}"`

**Nomes de campos para payment** (linhas 233-234):
- Adicionar fallbacks: `ddOrder.payment || ddOrder.payments?.[0] || ddOrder.paymentMethod || ddOrder.paymentDetails || {}`
- Se o campo de payment for um array, iterar e mapear cada um

**Valores em centavos** (linha 242):
- Remover a condicional `> 100`. TODOS os campos do tipo `Money` (`{value, currency}`) do DD sao em centavos - dividir por 100 sempre
- Aplicar a mesma logica para precos de items

### 2. `supabase/functions/dd-order-action/index.ts`

**Endpoint correto** (linha 92):
- Tentar primeiro: `PUT /admin-api/v1/kds/orders/{id}` (endpoint KDS documentado na OpenAPI)
- Se retornar 404, tentar fallback: `PUT /admin-api/v1/orders/{id}` 
- Logar a URL exata e resposta completa para debug

**Logging melhorado**:
- Logar URL completa, headers (sem token), e body antes da requisicao
- Logar resposta completa (nao truncada)

### 3. Deploy e verificacao

Deploy de ambas as funcoes e verificar nos logs:
- Quais campos de items e payment realmente existem no pedido DD
- Se o endpoint KDS funciona para atualizar status

---

## Arquivos Alterados

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/dd-polling/index.ts` | Logging expandido, fallbacks para items/payment, centavos corrigido |
| `supabase/functions/dd-order-action/index.ts` | Usar endpoint KDS, fallback, logging melhorado |

Nenhuma funcionalidade existente alterada. Apos deploy, sera necessario fazer um pedido teste para ver os logs completos e ajustar os nomes dos campos se necessario.

