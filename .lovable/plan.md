

# Plano — Remover Misto do PDV + Corrigir XML Export + Pagamentos Separados no Banco

## 3 Alterações

### 1. Remover "Misto" do PDV (CreateOrderDrawer.tsx)

O usuário quer que o PDV **não tenha mais a opção "Misto"**. Atualmente o Misto salva as formas concatenadas (ex: "Dinheiro, Crédito - Visa") como uma única string em `payment_type`. Isso é o problema central — não há separação real no banco.

**Ação:** Remover completamente do `CreateOrderDrawer.tsx`:
- Remover a `SelectItem value="mixed"` (linha 482)
- Remover toda a interface `MixedPaymentEntry`, constantes `MIXED_METHODS`, funções `getMixedPaymentString`, `updateMixedPayment`, `addMixedPayment`, `removeMixedPayment`, `needsBrandForMethod`, `getBrandsForMixedMethod`, `mixedTotal`, `mixedRemaining`
- Remover o state `mixedPayments` e o `useEffect` do scroll
- Remover o bloco UI de pagamento misto (linhas 516-588)
- Remover a lógica `if (paymentMethod === "mixed")` no `handleSubmit` (linhas 241-247)
- Remover a `ref` `mixedSectionRef`

O PDV só terá: Dinheiro, Débito, Crédito, PIX, Vale Refeição. Se precisar de 2+ formas, usa-se o fluxo de finalização do `PaymentConfirmationModal` (que já funciona corretamente com múltiplos métodos separados no `cash_movements`).

---

### 2. Corrigir Export XMLs (NotasFiscaisTab.tsx)

O export funciona na lógica mas o calendário inline pode ter conflito de interação. O problema mais provável é que o `pendingExportDateRange` não está sendo resetado ao abrir o dialog, fazendo com que o range fique "travado" de sessões anteriores.

**Ação em `NotasFiscaisTab.tsx`:**
- Ao abrir o dialog de export (linha 420), resetar `pendingExportDateRange` para `undefined`
- Verificar se o erro é no download em si — adicionar melhor tratamento de erro com `try/catch` mais específico e log do status HTTP
- Garantir que o `Calendar` inline receba `key` dinâmico para forçar re-render ao abrir

---

### 3. Pagamentos separados no banco + Normalização de métricas

**Problema atual:** Quando se usa o `PaymentConfirmationModal` com múltiplas formas, o `orders.payment_type` recebe uma string concatenada tipo "Dinheiro, Crédito - Visa". Nos relatórios, isso vira "Misto" em vez de metrificar cada forma separadamente.

**Problema 2:** "Crédito - Visa" (pago presencial) e "Crédito - Visa" (pago online) aparecem como coisas diferentes, e PIX normal vs PIX online idem. Devem ser a mesma coisa.

**Correção em `useOrderMetrics.ts`:**
- Na função `normalizeMethod`: quando encontrar string com vírgulas (método misto), **não retornar "Misto"**. Em vez disso, NÃO processar como método único — esse cenário será tratado pelo novo approach abaixo.
- Normalizar `credit_card_online` → mesmo bucket que `credit` → "Crédito"
- Normalizar `pix_online` → mesmo bucket que `pix` → "PIX"
- Strings como "Crédito - Visa" devem normalizar para "Crédito" (extrair antes do " - ")

**Correção na acumulação de métricas:**
- Para delivery orders com `payment_type` contendo vírgulas: fazer split por ", " e distribuir o valor proporcionalmente (ou igualmente se não há dados de valor individual). Alternativa pragmática: usar os `cash_movements` como fonte de verdade para pagamentos split, já que lá **cada método já está separado com seu valor**.

**Abordagem concreta para `useOrderMetrics.ts`:**
- Buscar `cash_movements` agrupados por `payment_method` no mesmo período
- Usar `cash_movements` como fonte primária de receita por método (já separados corretamente)
- Para delivery orders (que não têm cash_movements), normalizar `payment_type` extraindo a parte base antes de " - " e tratando `_online` como igual ao presencial
- Remover completamente a categoria "Misto" dos relatórios

**Correção no `nuvem-fiscal-emit`:**
- Quando `payment_type` contém vírgulas (misto), gerar múltiplos `detPag` em vez de um único `tPag: 99`. Buscar os `cash_movements` do pedido para obter cada método e valor individual. Se não encontrar, manter fallback `tPag: 99`.

---

## Arquivos a editar

| Arquivo | Alteração |
|---------|----------|
| `CreateOrderDrawer.tsx` | Remover toda lógica/UI do Misto |
| `NotasFiscaisTab.tsx` | Reset do pendingExportDateRange + key dinâmico no Calendar |
| `useOrderMetrics.ts` | Normalizar online=presencial, split por vírgula em vez de "Misto", extrair base do método |
| `nuvem-fiscal-emit/index.ts` | Gerar múltiplos detPag para pagamentos mistos |
| `lib/utils.ts` | Atualizar `formatPaymentMethod` para normalizar online igual presencial |

Nenhuma funcionalidade existente será quebrada — o `PaymentConfirmationModal` já salva corretamente cada método separado no `cash_movements`.

