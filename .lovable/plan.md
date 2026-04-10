
Diagnóstico atual

- Não, a maquininha não precisa estar ligada por cabo no PC nem na mesma rede Wi‑Fi. Esse fluxo funciona pela nuvem do provedor; então PC no ethernet/Wi‑Fi e maquininha no 4G é aceitável.
- As credenciais principais já estão funcionando: o sistema conseguiu listar o terminal e chegou a tentar criar a cobrança.
- O erro real nos logs não é falta de rede local nem falta de credenciais. O backend recebeu do Mercado Pago: `409 already_queued_order_on_terminal` = já existe uma cobrança pendente/enfileirada nesse terminal.
- O motivo de você ver só `Edge Function returned a non-2xx status code` é que a função `mercadopago-point` ainda devolve 409/400/500 direto para o frontend. A SDK então esconde o detalhe real e mostra essa mensagem genérica.

Plano de correção

1. Ajustar `supabase/functions/mercadopago-point/index.ts`
- Padronizar a resposta da função para sempre voltar HTTP 200 com corpo tipo `{ ok, data, error, code }`, inclusive em erro.
- Traduzir `already_queued_order_on_terminal` para mensagem clara: “Já existe uma cobrança pendente nessa maquininha”.
- Manter os logs estruturados e devolver detalhes úteis para o frontend.
- Corrigir também os pontos pendentes que ainda ficaram nessa função:
  - `list_terminals` ainda usa endpoint legado;
  - `create_store` precisa exigir/enviar `location`.

2. Ajustar `src/components/admin/settings/KioskSettings.tsx`
- Parar de depender só do `error` do `supabase.functions.invoke`.
- Ler `data.ok` e mostrar o erro real vindo do backend.
- No botão “Testar”, exibir mensagem amigável quando a fila do terminal já estiver ocupada.
- Se houver cobrança local pendente para esse terminal, oferecer ação para cancelar/liberar antes de testar de novo.
- Manter o comportamento de pular Store/POS quando o terminal já vier com `store_id` e `pos_id`.

3. Ajustar `src/components/kiosk/KioskPayment.tsx`
- Aplicar o mesmo padrão de leitura de resposta (`data.ok`) no fluxo real do totem.
- Tratar 409/fila ocupada sem cair no erro genérico.
- Garantir que `cancel_order` e `get_order` também tenham mensagens claras.

4. Consistência do backend
- Revisar o uso da tabela `point_order_payments` para detectar tentativa anterior que tenha ficado em `waiting_terminal` ou `processing`.
- Quando houver timeout ou cancelamento, garantir atualização correta no banco para não deixar terminal “preso” no fluxo interno.

Validação depois da implementação

- “Buscar” continua funcionando.
- “Testar” com terminal livre mostra sucesso e envia a cobrança.
- “Testar” com terminal ocupado mostra erro específico de fila pendente, não a mensagem genérica da Edge Function.
- Se existir teste pendente, cancelar/liberar passa a permitir novo teste.
- Fluxo segue funcionando com maquininha no 4G, sem necessidade de cabo ou mesma rede.

Arquivos
- `supabase/functions/mercadopago-point/index.ts`
- `src/components/admin/settings/KioskSettings.tsx`
- `src/components/kiosk/KioskPayment.tsx`
