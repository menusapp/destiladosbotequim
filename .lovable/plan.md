
Objetivo
- Corrigir as notificações de status para cliente no WhatsApp.
- Fazer o botão “Ativar todas as notificações” parar de se desativar sozinho.
- Preparar o Robô Menu’s para um modelo simples, seguro e realmente funcional.

Diagnóstico confirmado
- As notificações para o dono funcionam porque já usam o fluxo novo (`whatsapp-notifications` + configs do dono).
- As notificações para cliente estão quebradas porque hoje o sistema está dividido em dois modelos:
  - a tela “Para o Cliente” salva em `whatsapp_notification_configs`
  - mas o envio dos status do pedido em `useOrderStatusAdvance.ts` ainda lê os campos antigos de `whatsapp_config.message_*`
- Resultado: o usuário configura a aba nova, mas o envio real do cliente continua olhando para os campos antigos, então aceite/pronto/cancelado podem simplesmente não disparar.
- O toggle global ainda é frágil porque:
  - salva com `update()` sem validar `error`
  - não faz `upsert()` se a linha não existir
  - o visual dele ainda depende do status momentâneo da conexão, então ao sair e voltar ele parece desligado mesmo sem o usuário desligar
- No Robô Menu’s, o que existe hoje ainda foge do que você pediu:
  - ainda tem personalidade
  - ainda tem fluxo livre e totalmente personalizado
  - ainda tem instruções livres
  - e o envio real do bot tem um bug: ele chama `whatsapp-send` com payload diferente do esperado, então o simulador pode responder e o WhatsApp real não

Plano de implementação

1. Unificar as notificações do cliente no mesmo motor do dono
- Parar de usar o envio legado em `useOrderStatusAdvance.ts`.
- Passar aceite, saiu para entrega/pronto, cancelamento e avaliação final para o edge function `whatsapp-notifications`.
- Enviar contexto completo no payload:
  - `nome`
  - `numero_pedido`
  - `tempo_estimado`
  - `phone`
  - `motivo`
  - `link_avaliacao`
- Fazer fallback de telefone:
  - primeiro `orders.delivery_phone`
  - se faltar, buscar telefone do cliente por CPF, como já é feito em outros fluxos.
- Manter tudo centralizado nas configs da aba “Para o Cliente”.

2. Preservar templates antigos sem perder configuração já feita
- Criar uma migration de backfill:
  - copiar os textos antigos de `whatsapp_config.message_*` para `whatsapp_notification_configs` quando ainda não existir config nova correspondente.
- Assim, restaurantes que já tinham mensagens antigas não perdem seus textos.

3. Fazer o botão “Ativar todas as notificações” persistir de verdade
- Em `WhatsAppSettings.tsx`, trocar o `update()` simples por `upsert()` com validação real de erro.
- Atualizar também o `config.enabled` local, não só o estado `enabled`.
- Se ainda não existir registro em `whatsapp_config`, criar automaticamente.
- Deixar o padrão “ligado de fábrica” para novos restaurantes/conexões.
- Remover o comportamento visual que faz o toggle parecer desligado só porque a conexão ainda está sendo conferida.
- Manter o aviso de desconexão, mas sem forçar o botão a aparentar estado errado.

4. Garantir que as notificações do cliente sempre tenham config persistida
- Hoje a UI monta defaults em memória, mas nem sempre isso vira registro salvo.
- Vou ajustar para semear configs padrão no backend quando faltarem registros de cliente.
- Assim, o sistema não depende do usuário entrar e clicar em “Salvar” antes de funcionar.

5. Simplificar o Robô Menu’s exatamente no formato que você pediu
- Na interface:
  - manter `IA Ativa`
  - manter `Aceitar pedidos via WhatsApp`
  - manter apenas:
    - `Menu Numérico Padrão`
    - `Apenas o Link Digital`
- Remover:
  - personalidade
  - fluxo livre conversacional
  - totalmente personalizada
  - caixa livre de instruções para IA
- No lugar disso, deixar um comportamento funcional e fechado.

6. Fazer o Robô Menu’s conhecer o restaurante sem risco de vazar dados internos
- O bot vai usar somente dados públicos do restaurante:
  - nome
  - slug/link do cardápio
  - categorias
  - produtos
  - preços
  - promoções públicas
  - horários
  - taxa/prazo de entrega públicos
  - opções de atendimento disponíveis
- O bot não poderá responder sobre:
  - custo
  - lucro
  - faturamento
  - caixa
  - estoque interno/custos
  - credenciais
  - dados fiscais
  - configurações administrativas sensíveis
- Ou seja: ele saberá “tudo que o cliente pode ver”, e nada além disso.

7. Explicação de como “aceitar pedidos via WhatsApp” vai funcionar
- Eu faria um MVP simples e seguro, sem conversa solta.
- Fluxo proposto:
```text
Cliente manda mensagem
  -> bot responde com:
     1 Ver cardápio
     2 Status do pedido
     3 Horário de funcionamento
     4 Falar com atendente
     5 Fazer pedido

Se escolher "Fazer pedido":
  -> escolhe entrega ou retirada
  -> escolhe categoria
  -> escolhe produto por número
  -> escolhe quantidade
  -> escolhe complementos
  -> decide se quer adicionar mais itens
  -> informa nome
  -> informa endereço (se entrega)
  -> confirma resumo
  -> sistema cria um pedido normal
  -> pedido entra no painel admin
```
- Para a primeira versão, eu deixaria o pagamento fora da conversa do WhatsApp, para ficar confiável e simples.
- Depois do pedido confirmado, o bot pode orientar:
  - pagar no cardápio digital
  - pagar na entrega
  - pagar na retirada
  conforme a configuração do restaurante.

8. Corrigir o backend atual do Robô Menu’s antes de ativar de verdade
- Corrigir a chamada do `whatsapp-ai-bot` para `whatsapp-send`, porque hoje o payload está incompatível.
- Reaproveitar `whatsapp_conversations.current_step` + `order_draft` para virar uma máquina de estados real do pedido.
- Fazer o modo `link_only` responder só com o link.
- Fazer o modo `numeric_menu` responder sempre dentro do fluxo numérico, sem liberdade aberta.

Validação após implementação
- Cliente:
  - aceitar pedido e validar mensagem de aceite
  - avançar para pronto/saiu para entrega e validar mensagem
  - cancelar pedido e validar mensagem
  - finalizar e validar mensagem de avaliação
- Toggle global:
  - desligar
  - sair da aba
  - voltar
  - recarregar a página
  - confirmar que continua no estado salvo
  - validar que ele pausa dono + cliente ao mesmo tempo
- Robô Menu’s:
  - testar no simulador
  - testar no WhatsApp real
  - testar `link_only`
  - testar `numeric_menu`
  - testar pedido completo pelo WhatsApp até aparecer no admin
  - validar que perguntas sobre dados internos são bloqueadas

Detalhes técnicos
- Correções imediatas:
  - `src/hooks/useOrderStatusAdvance.ts`
  - `src/components/admin/settings/WhatsAppSettings.tsx`
  - `supabase/functions/whatsapp-notifications/index.ts`
  - migration de backfill para configs de cliente
- Robô Menu’s:
  - `src/components/admin/RoboMenusTab.tsx`
  - `supabase/functions/whatsapp-ai-bot/index.ts`
  - ajuste de integração com `whatsapp-send`
- Regra central da implementação:
  - unificar o envio do cliente no motor novo
  - remover dependência dos campos antigos `whatsapp_config.message_*`
  - deixar o robô restrito a dados públicos e fluxo guiado
