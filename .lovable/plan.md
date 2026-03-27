

# Correção: Rejeição de Pagamento + Download PDF/XML

## Diagnóstico

### Problema 1 - Rejeição de pagamento com cartão
A tabela `orders` só tem `payment_type` (ex: "Crédito - Visa", "cash", "debit"). A edge function `nuvem-fiscal-emit` tenta extrair a bandeira do cartão dessa string usando regex, mas falha na maioria dos casos porque:
- No delivery (PaymentStep), o método é salvo como `credit`, `debit`, `meal_voucher` **sem bandeira**
- No PDV (PaymentConfirmationModal), salva como "Cartão de Crédito - Visa" mas a função não parseia bem
- Não existe coluna `payment_brand` no banco

A SEFAZ rejeita quando `tPag` é `03` (crédito) ou `04` (débito) mas falta o nó `cartao` com `tBand`.

### Problema 2 - Download PDF mostra "UNAUTHORIZED"
A função `nuvem-fiscal-download` baixa o arquivo da Nuvem Fiscal e retorna em base64. Se a API retornar um erro HTML (ex: token expirado, 401), a função codifica esse HTML como base64, o frontend decodifica e abre como "PDF" — mostrando a página de erro. A função não valida o `content-type` da resposta antes de retornar.

## Plano de Correção

### 1. Migração SQL — adicionar `payment_brand` à tabela `orders`
```sql
ALTER TABLE orders ADD COLUMN payment_brand text;
```
Coluna para armazenar o código da bandeira (visa, mastercard, elo, alelo, sodexo, etc.)

### 2. Delivery Menu — PaymentStep: exigir seleção de bandeira
Quando o cliente seleciona crédito/débito/vale-refeição, **exigir** que clique na bandeira específica antes de continuar. Salvar a bandeira selecionada no `onContinue` data. O CheckoutDrawer (que monta o insert do pedido) salvará o `payment_brand` junto.

### 3. Comanda (mesa) — já tem seleção de bandeira, salvar no banco
O Comanda.tsx já mostra bandeiras ao selecionar cartão, mas não salva separadamente. Atualizar para salvar `payment_brand` no pedido.

### 4. PDV — PaymentConfirmationModal: salvar `payment_brand`
Já exige seleção de bandeira. Ao confirmar, salvar o código da bandeira na coluna `payment_brand` do pedido (além do `payment_type` concatenado que já salva).

### 5. Edge function `nuvem-fiscal-emit` — ler `payment_brand` do banco
- Buscar `payment_brand` junto com o pedido
- Usar esse campo diretamente no mapeamento de `tBand` (código numérico da SEFAZ)
- Se `payment_brand` estiver preenchido e o tipo for cartão, **sempre** incluir o nó `cartao`
- Para vale-refeição: mapear bandeiras específicas (alelo, sodexo, ticket, vr → `tBand: "99"` com `xPag`)

### 6. Edge function `nuvem-fiscal-download` — validar content-type
Antes de retornar, verificar se o `content-type` da resposta da Nuvem Fiscal é realmente `application/pdf` ou `application/xml`. Se for `text/html` ou outro, significa erro — retornar mensagem de erro ao invés de base64 de HTML.

## Arquivos impactados

- Migração SQL (nova coluna `payment_brand`)
- `src/components/menu/checkout/PaymentStep.tsx` — seleção obrigatória de bandeira
- `src/components/menu/checkout/CheckoutDrawer.tsx` ou `SummaryStep.tsx` — salvar brand no insert
- `src/components/admin/PaymentConfirmationModal.tsx` — salvar brand no update
- `src/pages/Comanda.tsx` — salvar brand
- `supabase/functions/nuvem-fiscal-emit/index.ts` — ler payment_brand, mapear tBand
- `supabase/functions/nuvem-fiscal-download/index.ts` — validar content-type da resposta

### Mapeamento de bandeira → código SEFAZ (tBand)
```
visa → "01", mastercard → "02", amex → "03", sorocred → "04",
hipercard → "05", elo → "06", diners → "07"
alelo/sodexo/ticket/vr/pluxee/ifood → tPag "10" (vale refeição), sem tBand
```

