

## Plano: Reestruturar pagamentos do Totem + Mover OAuth MP para Integrações

### Resumo

1. **Totem**: Remover opções separadas (crédito, débito, pix, pagamento online). Deixar apenas: **Dinheiro** (balcão), **Cartão na Maquininha** (com seleção de tipo + bandeira no totem), **Pix na Maquininha** (QR code direto no terminal).
2. **Admin Settings > Pagamentos**: Remover a seção de conexão OAuth do Mercado Pago. Manter apenas os toggles (aceitar Pix, aceitar cartão, ativar no delivery).
3. **Admin > Integrações**: Adicionar card do Mercado Pago com OAuth connect/disconnect (mesma lógica que hoje existe no OnlinePaymentsSettings).

### Mudanças detalhadas

**Arquivo 1: `src/components/kiosk/KioskPayment.tsx`**

Reescrever a lista de métodos de pagamento:
- **Dinheiro** (cash) — aparece se `kioskConfig.payment_cash` ativo
- **Cartão na Maquininha** (point_card) — aparece se `kioskConfig.payment_card` ativo e `pointTerminal` existe
  - Ao selecionar, abre sub-tela: escolher tipo (Crédito / Débito / Vale Refeição)
  - Depois escolher bandeira (Visa, Master, Elo, etc.)
  - Ao finalizar, envia para edge function com `payment_type` e `payment_brand` no payload
- **Pix na Maquininha** (point_pix) — aparece se `kioskConfig.payment_pix` ativo e `pointTerminal` existe
  - Envia para edge function com `payment.type: "bank_transfer"` (Pix no terminal)
- Remover: `credit_card`, `debit_card`, `pix` (avulsos), `payment_online`, `point_terminal` genérico

Enviar para a API do MP o tipo correto:
- Crédito → `payment.type: "credit_card"`
- Débito → `payment.type: "debit_card"`  
- Vale → `payment.type: "credit_card"` (vale refeição passa como crédito no MP)
- Pix → `payment.type: "bank_transfer"` (gera QR Pix no terminal)

**Arquivo 2: `supabase/functions/mercadopago-point/index.ts`**

Atualizar `createOrder` para aceitar parâmetro opcional `payment_type` (credit_card, debit_card, bank_transfer) e usar no payload da API:
```
payment: {
  installments: 1,
  type: payment_type || "credit_card",
  installments_cost: "seller",
}
```

**Arquivo 3: `src/components/admin/settings/OnlinePaymentsSettings.tsx`**

Remover toda a seção de OAuth (conectar/desconectar Mercado Pago). Manter apenas os 3 toggles:
- Aceitar Pix
- Aceitar Cartão de Crédito
- Ativar no Delivery

Mostrar esses toggles somente se o MP estiver conectado (status via RPC). Se não conectado, mostrar aviso: "Conecte o Mercado Pago na aba Integrações".

**Arquivo 4: `src/components/admin/IntegrationsTab.tsx`**

Adicionar card do **Mercado Pago** ao grid de integrações (ao lado do iFood e Delivery Direto):
- Card com ícone CreditCard, badge Conectado/Desconectado
- Sheet com: botão OAuth "Conectar com Mercado Pago", status de conexão, botão desconectar
- Reutilizar a lógica atual do `OnlinePaymentsSettings` (handleStartOAuth, handleDisconnect, fetchConfig)

**Arquivo 5: `src/components/admin/settings/KioskSettings.tsx`**

Remover toggle `payment_online` da seção de pagamentos do totem (já não faz sentido). Manter apenas: `payment_cash`, `payment_card`, `payment_pix`.

### Arquivos
- `src/components/kiosk/KioskPayment.tsx` — novo fluxo de pagamento
- `supabase/functions/mercadopago-point/index.ts` — aceitar payment_type
- `src/components/admin/settings/OnlinePaymentsSettings.tsx` — só toggles
- `src/components/admin/IntegrationsTab.tsx` — adicionar Mercado Pago
- `src/components/admin/settings/KioskSettings.tsx` — remover payment_online

