
Objetivo: corrigir o status de conexão do WhatsApp para refletir o estado real em toda a interface.

Diagnóstico confirmado
- Os logs de rede mostram que a função `whatsapp-instance` já respondeu `status: "connected"` com `state: "open"`.
- Antes disso, ela respondeu `status: "disconnected"` com `state: "connecting"`.
- Hoje o backend trata qualquer estado diferente de `open` como `disconnected`, e a tela só reconhece `pending` como estado intermediário.
- Resultado: durante a conexão — e em alguns fluxos após ela — a UI pode continuar exibindo “Desconectado” mesmo com a instância em processo de abertura ou já aberta.
- Além disso, as outras abas (Marketing e Robô Menu’s) leem o status salvo e podem ficar desatualizadas.

Plano
1. Normalizar os estados no backend
- Em `supabase/functions/whatsapp-instance/index.ts`, criar um mapeamento único:
  - `open` -> `connected`
  - `connecting` -> `connecting`
  - `close` / `closed` -> `disconnected`
  - sem instância -> `not_created`
- Parar de devolver `disconnected` quando o estado real for `connecting`.
- Retornar o status final normalizado também no payload de resposta, evitando resposta “mista”.

2. Robustecer a sincronização por webhook
- Em `supabase/functions/whatsapp-webhook/index.ts`, aceitar variações de evento da Evolution, como:
  - `connection.update` / `CONNECTION_UPDATE`
  - `qrcode.updated` / `QRCODE_UPDATED`
  - `messages.upsert` / `MESSAGES_UPSERT`
  - `logout` / `LOGOUT_INSTANCE`
- Extrair `instance` e `state` de formatos alternativos do payload.
- Atualizar o registro do restaurante com `connected`, `connecting`, `pending` e `disconnected` de forma consistente.

3. Corrigir a tela “Notificações WhatsApp”
- Em `src/components/admin/settings/WhatsAppSettings.tsx`, tratar `connecting` como estado intermediário visual, junto com `pending`.
- Ajustar `checkStatus()` para persistir e renderizar `connected`, `connecting`, `pending`, `disconnected` e `not_created`.
- Remover a dependência de `setConfig(prev => prev ? ... : null)` nos casos em que o estado precisa ser sincronizado mesmo sem config prévia carregada.

4. Sincronizar as abas dependentes
- Em `src/components/admin/MarketingTab.tsx` e `src/components/admin/RoboMenusTab.tsx`, usar a mesma lógica de sincronização da tela principal, em vez de depender só do valor salvo.
- Se fizer sentido, centralizar isso em um hook compartilhado para evitar divergência futura.

Validação
- Conectar pelo QR.
- Confirmar que durante o pareamento aparece “Aguardando conexão...”, e não “Desconectado”.
- Confirmar que ao abrir a sessão o status muda sozinho para “Conectado”.
- Recarregar o painel e validar o mesmo status em:
  - Notificações WhatsApp
  - Marketing
  - Robô Menu’s
- Enviar uma mensagem de teste para confirmar que as automações voltaram a liberar envio.

Detalhes técnicos
- Arquivos principais:
  - `supabase/functions/whatsapp-instance/index.ts`
  - `supabase/functions/whatsapp-webhook/index.ts`
  - `src/components/admin/settings/WhatsAppSettings.tsx`
  - `src/components/admin/MarketingTab.tsx`
  - `src/components/admin/RoboMenusTab.tsx`
- Não precisa migration.
- O foco é unificar a origem da verdade do status e eliminar a tradução incorreta de `connecting` para `disconnected`.
