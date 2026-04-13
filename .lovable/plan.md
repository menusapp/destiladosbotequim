

## Plano: Configurar webhook automaticamente ao criar instância

### Problema
Hoje, quando um restaurante conecta o WhatsApp, a edge function `whatsapp-instance` cria a instância na Evolution API mas **não configura o webhook** dessa instância. Isso significa que mensagens recebidas naquela instância nunca chegam ao sistema, a menos que alguém vá manualmente na VPS configurar o webhook global ou por instância.

### Solução
Adicionar uma chamada automática de configuração de webhook **dentro da própria edge function `whatsapp-instance`**, logo após criar a instância com sucesso. A Evolution API tem um endpoint `POST /webhook/set/{instanceName}` que permite configurar o webhook por instância via API. Como a edge function já tem acesso ao `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`, basta adicionar essa chamada.

### O que muda

**Arquivo:** `supabase/functions/whatsapp-instance/index.ts`

Após a criação da instância (linha ~272, depois do `upsert` no banco), adicionar uma função `configureWebhook(instanceName)` que faz:

```text
POST {EVOLUTION_API_URL}/webhook/set/{instanceName}
{
  "url": "{SUPABASE_URL}/functions/v1/whatsapp-webhook",
  "webhook_by_events": false,
  "webhook_base64": false,
  "events": ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"]
}
```

Essa chamada será feita automaticamente toda vez que:
- Uma instância nova é criada (`action: create`)
- Uma instância existente é reiniciada (`action: restart`)

Assim, qualquer restaurante que conectar o WhatsApp pelo painel terá o webhook configurado automaticamente, sem precisar tocar na VPS.

### Detalhes técnicos
- A URL do webhook é construída dinamicamente usando `Deno.env.get('SUPABASE_URL')` + `/functions/v1/whatsapp-webhook`
- Se a chamada de webhook falhar, o fluxo continua normalmente (log de aviso, sem bloquear o QR code)
- Não é necessária nenhuma variável de ambiente nova, tudo já existe

### Resumo
| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-instance/index.ts` | Adicionar `configureWebhook()` após criar/reiniciar instância |

Nenhuma alteração na VPS necessária. Depois disso, basta o restaurante conectar o WhatsApp pelo painel e o robô já vai funcionar.

