

## Plano: Separar fluxo PIX do fluxo de cartão no Totem

### Problema
O fluxo PIX atual na edge function `mercadopago-point` está dentro da action `create_order`, misturado com o fluxo de cartão. Quando o QR dinâmico falha, cai num fallback para `/v1/orders` que abre a tela de seleção na maquininha. O frontend também usa a mesma action `create_order` para ambos.

### Mudanças

**1. Edge Function `supabase/functions/mercadopago-point/index.ts`**

- Criar nova função `createPixQr(restaurantId, body)` dedicada ao PIX
- Usar exclusivamente `PUT /instore/orders/qr/seller/collectors/{mp_user_id}/pos/{mp_pos_id}/qrs`
- Se `mp_user_id` ou `mp_pos_id` não existirem → retornar erro claro `"POS não configurado para PIX"`
- **Sem fallback** para `/v1/orders`
- Logar request completo, response, status
- Registrar nova action no handler: `case "create_pix_qr"`

- Na função `createOrder` existente: **remover todo o bloco PIX** (linhas 138-205, o `if (isPix) {...}`) — deixar apenas o fluxo de cartão

**2. Frontend `src/components/kiosk/KioskPayment.tsx`**

- Na função `handlePointPayment`: quando `paymentMethod === "point_pix"`, chamar `action: "create_pix_qr"` em vez de `action: "create_order"`
- Não passar `payment_type` para PIX (desnecessário, action já é específica)
- Fluxo de cartão continua chamando `action: "create_order"` sem alteração

### Escopo
- 2 arquivos: edge function + KioskPayment.tsx
- Nenhuma alteração no fluxo de cartão
- Nenhuma alteração na lógica de polling (já funciona com `external_reference` / `merchant_orders`)

