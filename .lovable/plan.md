

## Plano: 2 Correções Urgentes no Pagamento do Totem

### Problema 1: Maquininha ainda pede pra escolher tipo de pagamento

A API `/v1/orders` (endpoint principal usado) **não suporta** o campo `payment.type` no payload — ela sempre manda a maquininha perguntar crédito/débito/pix. Esse campo só funciona na API legada `/point/integration-api/devices/{device_id}/payment-intents`.

**Correção**: Quando o totem envia `payment_type` (crédito, débito, pix), usar **sempre** a API de payment-intents primeiro (que aceita `payment.type`), e só usar `/v1/orders` como fallback quando não há `payment_type` especificado.

Arquivo: `supabase/functions/mercadopago-point/index.ts`
- Inverter a ordem: se `body.payment_type` existe, chamar payment-intents primeiro
- Fallback para `/v1/orders` apenas se payment-intents falhar

### Problema 2: Pedido aparece no painel antes de ser pago

O `createOrderInDB()` é chamado **antes** de enviar pra maquininha. O pedido já entra com `payment_type: "credit"` e `payment_brand: "Visa"`, e o admin vê como se já tivesse sido pago.

**Correção**: Para pagamentos na maquininha (point_card / point_pix), criar o pedido com `payment_type: null` e `payment_status: "awaiting_payment"`. Só após o polling confirmar `status: "processed"` + `accredited`, atualizar o pedido com o `payment_type` e `payment_brand` corretos e `payment_status: "paid"`.

Arquivo: `src/components/kiosk/KioskPayment.tsx`
- Em `createOrderInDB`, quando `isPointPayment`, setar `payment_type: null`, `payment_brand: null`, `payment_status: "awaiting_payment"`
- No callback de polling quando `pointStatus === "paid"`, fazer update com `payment_type`, `payment_brand`, `payment_status: "paid"`, `paid_at`

### Arquivos
- `supabase/functions/mercadopago-point/index.ts` — inverter ordem dos endpoints quando `payment_type` presente
- `src/components/kiosk/KioskPayment.tsx` — não enviar payment_type/brand na criação, atualizar só após confirmação

