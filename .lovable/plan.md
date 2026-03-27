

# Correção: Rejeição de Pagamento (cartao → card) + Número NFC-e

## Causa Raiz

Dois problemas combinados causam as rejeições:

### Problema 1 — Propriedade `cartao` em vez de `card`
Em `nuvem-fiscal-emit/index.ts` linhas 145 e 150, o código usa `cartao` como chave do objeto de pagamento. A API Nuvem Fiscal espera `card`. Quando o pedido é de crédito/débito, a API rejeita com `InvalidJsonProperty` e o `nfce_numero` NÃO é incrementado (a função retorna na linha 385-388 antes de chegar na linha 392).

### Problema 2 — Número NFC-e não incrementa em falha
O `nfce_numero` só é incrementado após chamada bem-sucedida (linha 392). Quando a API rejeita (ex: `InvalidJsonProperty`), o número fica estagnado. O próximo pedido (mesmo que seja PIX, correto) usa o mesmo nNF, e a SEFAZ pode rejeitá-lo por conflito ou por ter recebido a tentativa anterior parcialmente.

### Problema 3 — `payment_brand` nunca salvo
A coluna `payment_brand` existe mas está NULL em todos os pedidos. A função `mapPaymentMethod` cai no fallback de extrair a bandeira do `payment_type` (ex: "Crédito - Mastercard"), o que funciona mas depende do nome correto.

## Plano de Correção

### 1. Edge function `nuvem-fiscal-emit` — 3 correções

**a)** Renomear `cartao` → `card` nas linhas 145 e 150:
```typescript
// Linha 145
return { tPag: "03", vPag, card: { tpIntegra: "2", tBand: brand || "99" } };
// Linha 150
return { tPag: "04", vPag, card: { tpIntegra: "2", tBand: brand || "99" } };
```

**b)** Incrementar `nfce_numero` ANTES de chamar a API (mover linhas 392-395 para antes da linha 370), garantindo que cada tentativa use um número único.

**c)** Adicionar log do payload de pagamento para debug futuro:
```typescript
console.log("[NuvemFiscal] Payment mapping:", JSON.stringify(detPag));
```

### 2. Frontend — garantir `payment_brand` seja salvo

Verificar e corrigir `PaymentConfirmationModal.tsx` para salvar `payment_brand` separadamente no update do pedido, e `CheckoutDrawer.tsx` para salvar no insert.

## Arquivos impactados

- `supabase/functions/nuvem-fiscal-emit/index.ts` — `cartao` → `card`, incremento antecipado do nNF, log de debug
- `src/components/admin/PaymentConfirmationModal.tsx` — verificar se salva `payment_brand`
- `src/components/menu/CheckoutDrawer.tsx` — verificar se salva `payment_brand`

## Resultado esperado

- Pagamentos com cartão emitirão corretamente com o nó `card` + `tBand`
- PIX, dinheiro e outros continuarão funcionando
- Cada emissão usará um número NFC-e único, evitando conflitos na SEFAZ

