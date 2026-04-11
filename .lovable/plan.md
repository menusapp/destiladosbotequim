

## Plano: PIX direto na maquininha sem tela de seleção

### Diagnóstico

Para cartão, o sistema usa `/v1/orders` com `config.payment_method.default_type: "credit_card"` e isso pula a tela de seleção. Funciona.

Para PIX, o código **não usa esse mesmo caminho**. Em vez disso, tenta o endpoint `payment-intents` com payloads experimentais que retornam 400, e cai num fallback que cria a order **sem** `default_type` — por isso a maquininha mostra a tela de seleção.

A correção é usar o mesmo endpoint `/v1/orders` com `config.payment_method.default_type: "bank_transfer"` para PIX, exatamente como já funciona para cartões.

### O que muda

**Arquivo: `supabase/functions/mercadopago-point/index.ts`**

Na função `createOrder`, remover todo o bloco `if (isPix)` (linhas 139-208) que tenta 4 endpoints diferentes. Unificar o caminho do PIX com o dos cartões:

- PIX passa por `/v1/orders` com `config.payment_method.default_type: "bank_transfer"`
- Mantém o fallback sem `default_type` caso retorne erro (mas não `already_queued`)
- Mantém o fallback para `payment-intents` como último recurso
- Log detalhado em cada tentativa para diagnóstico

Resultado: um único fluxo para todos os tipos de pagamento (cartão e PIX), usando o mesmo endpoint que já funciona para cartões. A maquininha recebe `default_type: "bank_transfer"` e deve abrir o QR Code do PIX direto, sem tela de seleção.

### Risco e validação

Se `bank_transfer` não for aceito como `default_type` (a API retornar `property_value` error), o fallback sem tipo será usado e a maquininha mostrará o menu — comportamento atual. Logs detalhados permitirão diagnosticar rapidamente.

