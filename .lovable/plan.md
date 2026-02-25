

## Plano: Mercado Pago Connect (OAuth 2.0)

Implementacao completa do fluxo OAuth para conectar contas Mercado Pago dos restaurantes, substituindo a entrada manual de credenciais.

---

### 1. Migration: Adicionar colunas na tabela `online_payment_config`

Adicionar `mp_refresh_token` (TEXT) e `mp_user_id` (TEXT) a tabela existente.

```sql
ALTER TABLE online_payment_config 
  ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_user_id TEXT;
```

---

### 2. Edge Function: `mercadopago-oauth`

Criar `supabase/functions/mercadopago-oauth/index.ts`.

- Aceita POST com `{ code, state, redirectUri }`
- Troca o `code` por tokens via `POST https://api.mercadopago.com/oauth/token`
- Usa `MERCADOPAGO_APP_ID` e `MERCADOPAGO_CLIENT_SECRET` (secrets ja existentes)
- Salva `access_token`, `public_key`, `refresh_token`, `user_id` na tabela `online_payment_config` usando service role key (ignora RLS)
- Atualiza `connection_status` para `connected` e `connected_at`
- Retorna sucesso/erro com CORS headers

Registrar em `supabase/config.toml`:
```toml
[functions.mercadopago-oauth]
verify_jwt = false
```

---

### 3. Pagina de Callback: `src/pages/MercadoPagoCallback.tsx`

- Rota: `/admin/mercadopago/callback`
- No `useEffect`, captura `code` e `state` dos search params
- Chama `supabase.functions.invoke('mercadopago-oauth', { body: { code, state, redirectUri } })`
- Sucesso: toast verde + redirect para `/admin` (que volta para config-pagamentos-online)
- Erro: toast vermelho + redirect para `/admin`

Adicionar rota em `App.tsx` dentro de `ProtectedRoute`.

---

### 4. Atualizar `OnlinePaymentsSettings.tsx`

- Remover inputs manuais de Access Token e Public Key
- Remover estados `mpAccessToken`, `mpPublicKey`, `handleConnect`
- Adicionar botao "Conectar com Mercado Pago" que redireciona para:
  ```
  https://auth.mercadopago.com.br/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${configId}&redirect_uri=${origin}/admin/mercadopago/callback
  ```
- O `configId` sera o `id` do registro em `online_payment_config`. Se nao existir, criar um registro vazio primeiro (upsert com `connection_status: 'pending'`)
- O `MP_APP_ID` precisa estar acessivel no frontend. Opcoes:
  - Usar o `MERCADOPAGO_APP_ID` que ja esta nos secrets, exposto via uma edge function simples, OU
  - Hardcodar como variavel de ambiente VITE (mas nao temos). 
  - **Melhor abordagem**: Criar uma mini edge function `mercadopago-app-id` que retorna o client_id, ou embutir no `mercadopago-oauth` com GET. Usaremos GET no `mercadopago-oauth` para retornar apenas o `client_id`.

**Ajuste na edge function**: Alem do POST, aceitar GET que retorna `{ client_id }` lido de `Deno.env.get('MERCADOPAGO_APP_ID')`.

---

### Resumo dos arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Adicionar `mp_refresh_token`, `mp_user_id` |
| `supabase/functions/mercadopago-oauth/index.ts` | Criar (POST: troca code, GET: retorna client_id) |
| `supabase/config.toml` | Adicionar `[functions.mercadopago-oauth]` |
| `src/pages/MercadoPagoCallback.tsx` | Criar pagina de callback |
| `src/App.tsx` | Adicionar rota `/admin/mercadopago/callback` |
| `src/components/admin/settings/OnlinePaymentsSettings.tsx` | Substituir inputs por botao OAuth |

### Secrets necessarios

Ja existem: `MERCADOPAGO_APP_ID` e `MERCADOPAGO_CLIENT_SECRET`. Nenhum novo secret necessario.

