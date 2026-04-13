

## Plano: Simplificar pagamento no Totem — sem seleção de método

### O que muda

O cliente no totem não escolhe mais como pagar. Ao clicar "Finalizar e Pagar", o sistema envia direto para a maquininha **sem pré-selecionar tipo de cartão** (a maquininha mostra o menu dela), e exibe uma tela simples: "Continue o pagamento na maquininha" com uma seta para a direita embaixo. O sistema só aguarda o webhook/polling de confirmação.

Se não houver maquininha configurada, mantém apenas "Dinheiro" como opção (pagar no balcão).

### Arquivo alterado

`src/components/kiosk/KioskPayment.tsx`

### Mudanças

1. **Remover tela de seleção de método de pagamento** quando há maquininha configurada
   - Se `pointTerminal` existe: pular direto para envio à maquininha ao entrar na tela de pagamento
   - Não mostrar opções "Cartão", "PIX", "Dinheiro" — o terminal cuida disso

2. **Remover seleção de tipo de cartão e bandeira**
   - Não enviar `payment_type` na chamada ao `mercadopago-point` (ou enviar sem restrição para que o terminal mostre todas as opções)
   - Remover estados `cardStep`, `selectedCardType`, `selectedBrand` do fluxo principal

3. **Nova tela de espera**
   - Mostrar: valor total, texto "Continue o pagamento na maquininha", ícone de seta para direita (→) embaixo
   - Botão "Cancelar" discreto
   - Quando polling detecta pagamento aprovado → cria pedido e avança para confirmação

4. **Fallback sem maquininha**
   - Se `!pointTerminal`: mostrar apenas opção "Dinheiro (pagar no balcão)" como hoje, criar pedido como pendente

5. **Ajustar `createOrderInDB`**
   - Para pagamentos de terminal, `payment_type` fica como `"card"` genérico (ou o que vier do webhook depois)
   - Remover referências a `selectedCardType` e `selectedBrand` no label de pagamento

6. **Ajustar chamada `mercadopago-point`**
   - Não enviar `payment_type` no body, para que o terminal mostre o menu padrão de seleção

### Resultado
- Cliente toca "Finalizar e Pagar" → tela "Continue na maquininha" com seta → paga na maquininha como quiser → pedido criado automaticamente
- Sem tela de escolha de método no totem
- Maquininha mostra todas as opções (crédito, débito, PIX, vale)

