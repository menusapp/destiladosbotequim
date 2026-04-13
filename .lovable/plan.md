<final-text>Diagnóstico

- O sintoma bate com um problema no fluxo do Totem em `src/components/kiosk/KioskPayment.tsx`.
- Hoje o pedido é criado no cliente e os adicionais são gravados depois, um por um, neste trecho:
  - cria `orders`
  - cria `order_items`
  - faz `insert` em `order_item_extras`
  - depois marca o pedido como pago/preparo
- O ponto crítico: os inserts de `order_item_extras` estão sendo feitos sem checar `error`. Então, se qualquer adicional/complemento falhar, o pedido continua mesmo assim.
- Isso explica exatamente o que você relatou:
  - a maquininha cobra o valor certo do Totem
  - mas o pedido salvo chega só com o item base
  - mesa, caixa, notificação e impressão ficam com total menor porque todos recalculam a partir de `order_items + order_item_extras`

Plano de correção

1. Blindar a gravação do pedido do Totem
- Tirar a lógica “solta” de gravação dos adicionais no cliente.
- Fazer a criação do pedido do Totem de forma atômica no backend, em uma única operação/transação:
  - criar pedido
  - criar itens
  - criar extras/complementos
  - só então marcar como pago / aceito / preparando

2. Validar o total no backend
- Recalcular o total usando o que foi realmente salvo no banco.
- Usar esse total recalculado como fonte de verdade para o pedido final.
- Se houver divergência entre o que foi pago e o que foi persistido, interromper a finalização e registrar erro, em vez de salvar pedido incompleto.

3. Corrigir especificamente extras e complementos do Totem
- Garantir que:
  - extras de `product_extras` salvem com `product_extra_id`
  - complementos de categoria salvem com `product_extra_id = null`
  - `extra_name` sempre seja persistido
- Adicionar tratamento explícito de erro para nenhum adicional “sumir” silenciosamente.

4. Ajustar atualização imediata no painel
- Revisar as telas que mostram pedido recém-criado para garantir refresh após `order_item_extras`, especialmente onde hoje o refresh depende só de `orders` / `order_items`.
- Assim o pedido já aparece completo na mesa, caixa e detalhe do pedido logo após a criação.

5. Teste fim a fim obrigatório
- Repetir exatamente um cenário como o seu:
  - item base
  - variação
  - combo
  - complemento pago
- Confirmar que o mesmo valor aparece igual em:
  - Totem
  - maquininha
  - mesa/comanda
  - caixa
  - notificações
  - impressão

Detalhes técnicos

- Arquivos mais prováveis:
  - `src/components/kiosk/KioskPayment.tsx`
  - nova migration com função/RPC de criação do pedido do Totem
  - `src/components/admin/TableDetailView.tsx`
  - `src/components/admin/UnifiedOrdersTab.tsx`
  - `src/components/admin/OrderDetailModal.tsx`
  - `src/pages/RestaurantAdmin.tsx`
- Vou manter o fluxo atual de Totem “cria pendente -> depois finaliza pago”, porque os gatilhos financeiros/estoque já dependem disso.
- A diferença é que a persistência de itens + adicionais vai deixar de ser frágil e passar a ser garantida antes da finalização.

Resultado esperado após a implementação

- Não vai mais existir pedido do Totem pago na maquininha e salvo sem combo/adicional.
- O total do pedido ficará consistente em todo o sistema.
- Se houver qualquer erro de gravação, o sistema não vai mais “engolir” o problema em silêncio.</final-text>