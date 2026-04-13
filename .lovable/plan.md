

## Plano: Corrigir robô que não responde + lentidão na aba WhatsApp

### Problema 1: Robô não responde (BUG CRÍTICO)

No `whatsapp-webhook/index.ts`, linha 133:
```typescript
const msgData = data?.message || data;
```

O payload da Evolution API v2 tem esta estrutura:
```
body.data.key.remoteJid = "5514997522469@s.whatsapp.net"
body.data.message.conversation = "ola"
body.data.key.fromMe = false
```

Como `data.message` existe (é o objeto `{ conversation: "ola", messageContextInfo: ... }`), o código pega `data.message` como `msgData`. Depois tenta acessar `msgData.key.remoteJid` — que não existe nesse nível. Resultado: `customerPhone = ""` e `messageText = ""`, e a mensagem é ignorada com log "skipped".

**Correção:** Extrair `key`, `remoteJid` e `messageText` diretamente de `data` (o objeto raiz do payload), não de `data.message`.

### Problema 2: Lentidão ao abrir a aba

No `whatsapp-instance/index.ts`, toda vez que o GET detecta status `connected`, chama `await configureWebhook(resolvedName)` — que faz um POST HTTP para a Evolution API na VPS. Isso adiciona 1-3 segundos a cada carregamento da página.

**Correção:** Remover o `configureWebhook` do GET. O webhook já é configurado no POST (create/restart), então não precisa reconfigurar a cada verificação de status.

### Sobre a VPS

Não precisa fazer nada na VPS. O webhook é configurado automaticamente pela edge function quando a instância é criada ou reiniciada. O único requisito é que a VPS esteja rodando a Evolution API com as portas abertas — o que já está funcionando (os logs mostram mensagens chegando).

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Corrigir extração de dados da mensagem (linhas 131-158) |
| `supabase/functions/whatsapp-instance/index.ts` | Remover `configureWebhook` do fluxo GET (linha 242) |

### Resultado esperado
- Robô responde imediatamente às mensagens
- Aba WhatsApp carrega em ~1s em vez de 3-4s

