

## Plano: Pular etapa de resumo para pagamentos online

### Problema
Após pagar via PIX/Cartão no `OnlinePaymentStep`, o cliente vai para a tela de resumo e precisa clicar "Finalizar Pedido". Muitos pagam, acham que terminou, e fecham o app sem enviar o pedido.

### Solução

**Arquivo: `src/components/menu/CheckoutDrawer.tsx`**

#### Mudança 1 — Callback do `OnlinePaymentStep` chama `handleFinishOrder` diretamente

No callback `onConfirm` do `OnlinePaymentStep` (linhas 671-679), em vez de `setPaymentData` + `setStep("summary")`:

1. Atualizar `paymentData` com o `onlinePaymentId` e `confirmed: true`
2. Chamar `handleFinishOrder` diretamente, passando o `onlinePaymentId` como parâmetro

#### Mudança 2 — Adaptar `handleFinishOrder` para aceitar `onlinePaymentId` opcional

Modificar a assinatura de `handleFinishOrder` para aceitar um parâmetro opcional `onlinePaymentId?: string`. Quando presente, incluir no `orderData` para rastreabilidade (campo `notes` ou campo dedicado se existir). Marcar o status como `confirmed` em vez de `pending` quando o pagamento online já foi processado.

#### Mudança 3 — Evitar problema de state assíncrono

Como `setPaymentData` é assíncrono (React state), o `handleFinishOrder` não verá o state atualizado se chamado imediatamente. A solução é passar os dados necessários diretamente como parâmetro da função, sem depender do state.

```text
Fluxo ATUAL (online):
  PaymentStep → OnlinePaymentStep → [paga] → SummaryStep → [clica Finalizar] → submitOrder

Fluxo NOVO (online):
  PaymentStep → OnlinePaymentStep → [paga] → submitOrder (direto)

Fluxo LOCAL (sem mudança):
  PaymentStep → SummaryStep → [clica Finalizar] → submitOrder
```

### Escopo de arquivos
- `src/components/menu/CheckoutDrawer.tsx` — única mudança necessária

