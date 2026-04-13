
Objetivo

- Parar definitivamente as respostas duplicadas do robô.
- Fazer todo link enviado no WhatsApp usar o endereço público real do restaurante, nunca URL interna/preview da Lovable.

Plano

1. Centralizar a geração dos links públicos
- Criar uma fonte única para montar URL pública do restaurante a partir do slug.
- Substituir o hardcode em `supabase/functions/whatsapp-ai-bot/index.ts`, que hoje usa `https://menu-mesa-master.lovable.app/${restaurant.slug}`.
- Substituir em `src/hooks/useOrderStatusAdvance.ts` os links montados com `window.location.origin`, porque isso pega o domínio do admin/preview e manda o link errado no WhatsApp.
- Deixar todos os links do bot e das notificações usando a mesma regra.

2. Corrigir o link de avaliação
- Ajustar a rota usada nas mensagens de avaliação.
- Hoje o hook monta `/:slug/pedido-confirmado/:id`, mas a rota real cadastrada em `src/App.tsx` é `/:slug/pedido/:orderId`.
- Assim, o link de avaliação/status vai abrir a página certa no domínio publicado.

3. Trocar a deduplicação frágil por deduplicação persistente
- Remover a confiança na `Map` em memória de `supabase/functions/whatsapp-webhook/index.ts`.
- Criar uma tabela leve de controle de eventos recebidos, com chave única por restaurante + `message_id` (e fallback por fingerprint quando necessário).
- No webhook, registrar o evento antes de chamar `whatsapp-ai-bot`; se já existir, ignorar sem responder de novo.
- Isso resolve o problema mesmo com invocações paralelas/serverless.

4. Endurecer o webhook sem mexer na VPS
- Garantir que só mensagens 1:1 válidas entrem no fluxo do robô.
- Manter a saudação e o menu atuais; a mudança aqui será apenas idempotência e links corretos.
- Não precisa fazer nada manual na VPS para essa correção.

Arquivos previstos

- `supabase/functions/whatsapp-ai-bot/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
- `src/hooks/useOrderStatusAdvance.ts`
- `src/App.tsx` (apenas para alinhar/verificar rota usada nos links)
- nova migration em `supabase/migrations/...`
- possivelmente um helper novo para URL pública compartilhada no frontend

Detalhes técnicos

- Causa do link errado:
  - `whatsapp-ai-bot` ainda está hardcoded com domínio `.lovable.app`
  - `useOrderStatusAdvance` usa `window.location.origin`, então o sistema envia o domínio da sessão atual do admin/preview
- Causa da duplicidade:
  - a deduplicação atual é só em memória; em ambiente serverless isso não garante bloqueio entre execuções concorrentes
- Assunção de implementação:
  - vou apontar os links para o domínio público oficial do produto/restaurante em vez da URL interna da Lovable; se a regra oficial for `menusapp.com.br/{slug}`, tudo sai por ela
- Resultado esperado:
  - 1 mensagem recebida = 1 resposta
  - links de cardápio e avaliação sempre saindo com URL pública correta
  - sem depender de ajuste manual na VPS

Validação final

- Enviar uma única mensagem de teste e confirmar que chega só uma resposta.
- Testar o link do cardápio no WhatsApp.
- Testar o link de avaliação/status no WhatsApp.
- Repetir com mais de uma mensagem seguida para garantir que o bloqueio de duplicidade ficou estável.
