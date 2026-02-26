

## Trocar credenciais do Mercado Pago para modo teste

O usuário precisa substituir as credenciais de produção pelas de teste do Mercado Pago para evitar bloqueios do antifraude durante desenvolvimento.

### Secrets a atualizar

1. **MERCADOPAGO_ACCESS_TOKEN** — Access Token de teste (começa com `TEST-...`)
2. **MERCADOPAGO_PUBLIC_KEY** — Public Key de teste (começa com `TEST-...`)
3. **MERCADOPAGO_APP_ID** — App ID (mesmo valor, mas confirmar)

### Onde encontrar as credenciais de teste

1. Acesse [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
2. Vá em **Suas integrações** → selecione sua aplicação
3. Na aba **Credenciais de teste**, copie:
   - `Access Token` (TEST-...)
   - `Public Key` (TEST-...)

### Implementação

Usar a ferramenta `add_secret` para cada um dos 3 secrets, permitindo que o usuário cole os novos valores de teste.

### Importante

- Com credenciais de teste, use os [cartões de teste do MP](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards) (ex: `5031 4332 1540 6351`, CVV `123`, validade futura)
- PIX de teste também funciona normalmente
- Quando for para produção, basta trocar de volta para as credenciais reais

