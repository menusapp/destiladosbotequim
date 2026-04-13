

## Plano: 3 Correções — Toggle, Tempo de Preparo Delivery, Robô no WhatsApp Real

### 1. Remover card "Ativar todas as notificações" e manter apenas toggles individuais

**Problema:** A tabela `whatsapp_config` tem uma RLS policy `block_direct_access` que bloqueia TODAS as operações diretas do frontend (`qual: false`, `with_check: false`). O `upsert` do toggle global sempre falha por causa disso.

**Solução:** Remover o card "Notificações Automáticas" inteiro de `WhatsAppSettings.tsx` (linhas ~646-659). Os toggles individuais de cada notificação (que salvam em `whatsapp_notification_configs`, não em `whatsapp_config`) já funcionam e são o controle real. Também remover o estado `enabled`, `handleToggleEnabled`, e as referências a ele.

**Arquivo:** `src/components/admin/settings/WhatsAppSettings.tsx`

---

### 2. Adicionar campo "Tempo de preparo para Delivery" na aba Operacional

**Problema:** O `prep_time_minutes` na tabela `restaurants` já existe e é usado como tempo estimado nas notificações e no checkout. Porém na aba Operacional ele aparece apenas como "Tempo de Preparo nos Pedidos" (timer de mesa). Falta um campo editável para o tempo que é informado ao cliente de delivery.

**Solução:** 
- Na `CompanyDataSettings.tsx`, dentro da aba Operacional, adicionar um novo Card "Tempo Estimado para Delivery" com um campo numérico que edita `prep_time_minutes`.
- Também adicionar `pickup_time_minutes` para retirada.
- O save já persiste `prep_time_minutes`, só falta o campo visual dedicado ao delivery.

**Arquivo:** `src/components/admin/settings/CompanyDataSettings.tsx`

---

### 3. Robô Menu's — O que falta para funcionar no WhatsApp real

O simulador funciona porque chama a edge function `whatsapp-ai-bot` diretamente. No WhatsApp real, o fluxo é:

```text
Cliente manda mensagem no WhatsApp
  → Evolution API recebe
  → Evolution API chama webhook global
  → webhook global aponta para: supabase/functions/v1/whatsapp-webhook
  → whatsapp-webhook recebe evento messages.upsert
  → whatsapp-webhook chama whatsapp-ai-bot (fire-and-forget)
  → whatsapp-ai-bot processa e chama whatsapp-send para responder
```

O código já está todo implementado (linhas 131-156 do `whatsapp-webhook`). O que provavelmente falta é a **configuração do webhook na VPS/Evolution API** para apontar para o endpoint correto.

#### Passo a passo para configurar na VPS:

1. **Acessar o Portainer** na sua VPS e verificar se a Evolution API está rodando.

2. **Configurar o webhook global** da Evolution API. Existem duas formas:

   **Opção A — Via variável de ambiente** (recomendado):
   No `docker-compose.yml` ou nas variáveis de ambiente do container da Evolution API, adicionar/verificar:
   ```
   WEBHOOK_GLOBAL_ENABLED=true
   WEBHOOK_GLOBAL_URL=https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/whatsapp-webhook
   WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
   ```
   Após alterar, reiniciar o container.

   **Opção B — Via API** (se já estiver rodando e não quiser reiniciar):
   ```bash
   curl -X POST "SUA_EVOLUTION_API_URL/webhook/set/NOME_DA_INSTANCIA" \
     -H "apikey: SUA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/whatsapp-webhook",
       "webhook_by_events": false,
       "webhook_base64": false,
       "events": [
         "CONNECTION_UPDATE",
         "QRCODE_UPDATED",
         "MESSAGES_UPSERT"
       ]
     }'
   ```
   Substitua `SUA_EVOLUTION_API_URL` pela URL real (ex: `https://evo.seudominio.com.br`) e `NOME_DA_INSTANCIA` pelo nome da instância do restaurante (ex: `rest-rods`).

3. **Testar**: Envie uma mensagem para o número do WhatsApp conectado. Verifique os logs da edge function `whatsapp-webhook` para confirmar que o evento chegou e que o `whatsapp-ai-bot` foi chamado.

4. **Se o webhook já estiver configurado** mas não funciona, verificar nos logs do `whatsapp-webhook` se há erros. Pode ser que a instância na Evolution tenha um nome diferente do registrado em `whatsapp_config.instance_name`.

**Nenhuma alteração de código necessária para o robô** — o fluxo inteiro já está implementado. É puramente configuração da VPS.

---

### Resumo de arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `WhatsAppSettings.tsx` | Remover card "Notificações Automáticas" e todo o código do toggle global |
| `CompanyDataSettings.tsx` | Adicionar card com campo de tempo estimado delivery + retirada |

