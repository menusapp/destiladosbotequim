
Objetivo: corrigir de forma definitiva os 4 pontos sem quebrar o fluxo atual (emissão fiscal, PDV e estoque).

1) Diagnóstico confirmado (antes de alterar)
- Erro atual da emissão está claro nos logs: `Property "tBand" does not refer to a known property in type "Nfe.Sefaz.DTO.TDetPag"`.
- Causa: `tBand` está sendo enviado no nível errado de `detPag`; para cartão, deve ir dentro do grupo `card`.
- Estoque PDV: pedidos de delivery/retirada/viagem já nascem em `preparing`, mas os itens são inseridos depois do pedido; o trigger de `orders` roda antes de existirem `order_items`, então não desconta nada.
- Mesa: quando pedido local sai de `pending` direto para `delivered` no fechamento, pode pular a transição que deduz estoque.
- Chave “inválida” para contador: hoje a função salva `nfe_key` também em rejeições e usa fallback por `protocolo` que pode classificar incorretamente; isso gera chave não confiável para consulta.

2) Correção fiscal (edge function `nuvem-fiscal-emit`) — sem mexer no restante
- Ajustar `mapPaymentMethod` para retornar estrutura válida por tipo:
  - `cash/dinheiro` → `detPag: { tPag: "01", vPag }`
  - `pix` → `detPag: { tPag: "17", vPag }`
  - `credit/...` → `detPag: { tPag: "03", vPag, card: { tpIntegra: "2", tBand: "<codigo>" } }`
  - `debit/...` → `detPag: { tPag: "04", vPag, card: { tpIntegra: "2", tBand: "<codigo>" } }`
  - `meal_voucher` → `detPag: { tPag: "10", vPag }`
  - `ifood/online` e desconhecidos → `detPag: { tPag: "99", vPag, xPag: "<descrição>" }`
- Regra crítica: `xPag` só quando `tPag = "99"`.
- Remover `tBand` de `detPag` raiz (passa a ficar somente em `card`).
- Manter compatibilidade com textos existentes (“Crédito - Visa”, “Débito - Mastercard”, etc.), extraindo bandeira.
- Se cartão vier sem bandeira legível, usar fallback seguro `tBand: "99"` (Outros) para não rejeitar por ausência de dados do cartão.

3) Confiabilidade da chave da nota (contador)
- Ajustar mapeamento de status para “authorized” apenas quando houver sinal explícito de autorização (não promover por fallback genérico de protocolo).
- Persistir `nfe_key` como chave oficial somente quando status final for autorizado (ou documento já autorizado e depois cancelado).
- Em rejeição/erro, manter mensagem técnica completa e não tratar chave como válida para consulta.
- Na tela de detalhes da nota, destacar claramente quando a nota não está autorizada (evita o contador usar chave de nota rejeitada).

4) Baixa automática de estoque no PDV (todos os tipos)
- `PDVTab.tsx`:
  - após inserir cada `order_item` (delivery/retirada/viagem em `preparing`), chamar `rpc("deduct_stock_for_order_item")`.
  - no fechamento de comanda em `TableDetailDialog.tsx`, se o pedido ainda estiver `pending`, deduzir itens antes de marcar `delivered` (cobre mesa que pulou “accepted”).
- `CreateOrderDrawer.tsx`:
  - replicar a mesma lógica de dedução pós-inserção de itens para manter consistência entre os dois fluxos de criação manual.
- Não alterar a lógica existente de trigger; apenas complementar os pontos em que ele não enxerga itens no momento da transição.

5) Bandeira de cartão direto no PDV (sem conflito depois)
- Em `PDVTab.tsx` e `CreateOrderDrawer.tsx`, quando pagamento for `credit`/`debit`, abrir seleção obrigatória de bandeira (Visa, Mastercard, Elo, Amex, Hipercard, Diners).
- Salvar `payment_type` já no formato final (ex.: `Crédito - Visa`, `Débito - Elo`), alinhado com o mapeamento fiscal da emissão.
- Métodos não cartão permanecem iguais.

6) Validação de não regressão (E2E obrigatório)
- Teste 1: emitir NFC-e com Crédito/Débito (com bandeira) e confirmar ausência do erro `tBand`.
- Teste 2: PDV delivery/retirada/viagem → criar pedido e verificar `stock_movements` de saída imediatamente após inclusão dos itens.
- Teste 3: PDV mesa sem “aceitar” manualmente → fechar pagamento e confirmar baixa de estoque antes do `delivered`.
- Teste 4: nota autorizada recente → contador consulta chave e valida; nota rejeitada não deve ser tratada como chave válida.
- Teste 5: revalidar fluxo atual de dinheiro/pix para garantir que nada foi quebrado.

Arquivos impactados
- `supabase/functions/nuvem-fiscal-emit/index.ts`
- `src/components/admin/PDVTab.tsx`
- `src/components/admin/CreateOrderDrawer.tsx`
- `src/components/admin/TableDetailDialog.tsx`
- `src/components/admin/FiscalNoteDetailSheet.tsx` (ajuste de exibição da chave conforme status)
