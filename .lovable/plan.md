

## Plano: Corrigir PIX direto no terminal + Pedido duplicado

### Problema 1: PIX abre tela de seleção
Nos logs vejo claramente: a API de **payment-intents** retorna erro 400 para `bank_transfer` — ela só aceita `credit_card`, `debit_card`, `voucher_card`. O sistema cai no fallback `/v1/orders` que **não suporta** pré-selecionar tipo, então a maquininha mostra o menu de seleção.

**Correção**: Para PIX, pular payment-intents e usar `/v1/orders` com restrição de método no config: `config.point.payment_type: "bank_transfer"`. Se a API do MP não aceitar esse campo, usar `allowed_payment_methods` no payload. Testaremos ambas abordagens.

Arquivo: `supabase/functions/mercadopago-point/index.ts`
- Quando `payment_type === "bank_transfer"` (PIX), ir direto para `/v1/orders` com campo de restrição no config
- NÃO tentar payment-intents para PIX (sempre falha)

### Problema 2: Pedido duplicado
O polling roda a cada 3s. Quando o status muda para `processed/accredited`, o callback chama `createOrderInDB()` — mas o `clearInterval` pode não executar antes do próximo tick do interval, causando **duas chamadas** a `createOrderInDB()`.

**Correção**: Adicionar um `ref` de guarda (`orderCreationInProgressRef`) que impede chamadas duplicadas.

Arquivo: `src/components/kiosk/KioskPayment.tsx`
- Adicionar `const orderCreationInProgressRef = useRef(false)` 
- No callback de polling, antes de chamar `createOrderInDB()`, checar e setar o ref
- `if (orderCreationInProgressRef.current) return;`
- `orderCreationInProgressRef.current = true;`

### Arquivos
- `supabase/functions/mercadopago-point/index.ts` — PIX direto sem payment-intents
- `src/components/kiosk/KioskPayment.tsx` — guard contra pedido duplicado

