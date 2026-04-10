

## Plano: Adicionar botão "Cancelar cobrança pendente" no admin

### Situação atual

A correção anterior funcionou — agora o erro real do Mercado Pago aparece: "Já existe uma cobrança pendente nessa maquininha". Porém:

1. Não existe botão para cancelar essa cobrança pendente no admin
2. A tabela `point_order_payments` está vazia (as tentativas anteriores não foram salvas porque o `insert_point_order_payment` RPC não existia ou falhou silenciosamente)
3. Sem o `mp_order_id` salvo, não dá pra cancelar diretamente

### Correções

**1. Adicionar ação "Listar orders pendentes" na edge function**

Nova action `list_pending_orders` que consulta o MP por orders do terminal que estejam em status `opened`/`processing`. Isso permite descobrir o `mp_order_id` da cobrança travada mesmo sem ter salvo no banco.

Endpoint: `GET /v1/orders?type=point&status=opened` (filtrado pelo terminal)

**2. Adicionar botão "Cancelar pendente" no KioskSettings**

Quando o teste falhar com código `already_queued_order_on_terminal`:
- Mostrar botão "Cancelar cobrança pendente"
- Ao clicar, chamar `list_pending_orders` → pegar o `mp_order_id` → chamar `cancel_order`
- Após cancelar, liberar para novo teste

**3. Garantir que `insert_point_order_payment` salva corretamente**

Verificar se a RPC existe e funciona para que futuras cobranças fiquem registradas no banco.

### Arquivos
- `supabase/functions/mercadopago-point/index.ts` — nova action `list_pending_orders`
- `src/components/admin/settings/KioskSettings.tsx` — botão cancelar + lógica

