

## Plano: Corrigir Pagamento + Toggle Global de Automação WhatsApp

### Problema 1 — Erro ao confirmar pagamento

A trigger `add_delivery_order_to_cash_register` referencia `NEW.total_amount`, mas a tabela `orders` não tem essa coluna. Qualquer `UPDATE` na tabela `orders` dispara essa trigger e causa erro.

**Correção:** Migration para substituir a função. Remover a referência a `NEW.total_amount` e usar apenas o cálculo a partir dos `order_items` (que já existe na mesma função como fallback).

**Renomear:** Trocar "Confirmar Pagamento" → "Forma de Pagamento" nos arquivos:
- `OrderDetailModal.tsx` (linha 479)
- `PaymentConfirmationModal.tsx` (linha 568 — botão do modal)
- `UnifiedOrdersTab.tsx` (se aplicável)

O toast de sucesso muda de "Pagamento confirmado!" para "Forma de pagamento registrada!".

### Problema 2 — Toggle "Ativar Automação" não funciona

O switch `enabled` é apenas estado local — nunca é salvo no banco ao ser alternado. Ele só é lido do `whatsapp_config.enabled` no mount.

**Correção:**
- Adicionar um `useEffect` que, ao mudar `enabled`, faz `UPDATE` no `whatsapp_config` setando `enabled = true/false` para o restaurante.
- Na edge function `whatsapp-notifications`, o campo `whatsapp_config.enabled` já é verificado. Então, desabilitar o toggle vai pausar todas as notificações de uma vez.
- Renomear o card de "Ativar Automação" para "Pausar/Ativar Notificações" com descrição mais clara.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Corrigir `add_delivery_order_to_cash_register` removendo `NEW.total_amount` |
| `OrderDetailModal.tsx` | "Confirmar Pagamento" → "Forma de Pagamento" |
| `PaymentConfirmationModal.tsx` | Botão e toast renomeados |
| `WhatsAppSettings.tsx` | Persistir toggle `enabled` no banco ao alternar |

