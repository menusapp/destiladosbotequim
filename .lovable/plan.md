

## Plano: Reconectar WhatsApp com a Nova VPS

O código do sistema já está 100% pronto. Tudo que precisa ser feito é atualizar 2 segredos (secrets) e configurar o webhook na Evolution API.

### Passo 1 — Atualizar os segredos do projeto

Os segredos `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` já existem, mas apontam para o servidor antigo. Preciso atualizá-los para a nova VPS:

- **EVOLUTION_API_URL**: `http://SEU_IP_VPS:8080` (o endereço da Evolution API na nova VPS)
- **EVOLUTION_API_KEY**: a API key que você configurou no `.env` da Evolution na VPS

Vou pedir para você inserir esses valores.

### Passo 2 — Configurar o Webhook na Evolution API

A Evolution API precisa saber para onde enviar eventos (mensagens recebidas, conexão, QR code, etc.). Você precisa configurar o webhook global na Evolution API apontando para:

```
https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/whatsapp-webhook
```

Isso pode ser feito de duas formas:
- **Via `.env` da Evolution** (recomendado): adicionar as variáveis de webhook no docker-compose
- **Via API**: fazer um POST para configurar o webhook da instância

Vou fornecer os comandos exatos.

### Passo 3 — Reconectar via painel

Depois dos segredos atualizados e webhook configurado, basta ir em **Notificações WhatsApp** no painel admin e clicar em **Conectar WhatsApp**. O sistema vai criar a instância, gerar o QR code, e ao escanear tudo volta a funcionar:

- Notificações automáticas para clientes (pedidos)
- Notificações para o dono (caixa)
- Notificações de reservas
- Campanhas de marketing
- Robô Menu's

### Nenhuma alteração de código necessária

O sistema já suporta tudo. É só questão de apontar para o novo servidor.

### Resumo

| Item | Ação |
|------|------|
| `EVOLUTION_API_URL` | Atualizar para IP da nova VPS |
| `EVOLUTION_API_KEY` | Atualizar para a key da nova VPS |
| Webhook na Evolution | Apontar para o endpoint do sistema |
| Reconectar WhatsApp | Usar o painel admin |

