

## Plano: Reduzir valor mínimo de pagamento online para R$ 1,00

### Contexto
O limite de R$ 5,00 foi adicionado como validação no frontend (`OnlinePaymentStep.tsx`) para evitar erros da API do Mercado Pago. O Mercado Pago em produção exige mínimo de R$ 1,00 para Pix (não R$ 5,00 como estava configurado). Portanto, podemos baixar com segurança.

### Alteração

**Arquivo:** `src/components/menu/checkout/OnlinePaymentStep.tsx`

Duas mudanças simples:
1. Linha 98: trocar `amount < 5` por `amount < 1`
2. Linha 100: trocar mensagem para "R$ 1,00"
3. Linha 177: trocar `amount < 5` por `amount < 1`
4. Linha 178: trocar mensagem para "R$ 1,00"

Apenas validação frontend. Nenhuma mudança no backend.

