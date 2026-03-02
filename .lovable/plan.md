

## Diagnóstico: "Payer email forbidden" (403, código 4390)

### Causa Raiz

O erro mudou de `internal_error` (500) para `Payer email forbidden` (403). Isso confirma que o MP agora está validando o email corretamente, mas **rejeita emails `@testuser.com` inventados**. 

No sandbox do Mercado Pago, o email do pagador precisa ser de um **Test User real** criado via API do MP — não basta o domínio `@testuser.com`, o email precisa existir como usuário de teste registrado.

### Solução

Modificar a Edge Function `mercadopago-charge` para, quando em modo sandbox, **criar automaticamente um Test User via API do MP** (`POST /users/test_user`) e usar o email retornado como payer. O test user criado é cacheado no próprio request.

### Arquivo a editar

**`supabase/functions/mercadopago-charge/index.ts`** — Substituir o `safePayer` atual por uma função async que:

1. Se `isSandbox`, faz `POST https://api.mercadopago.com/users/test_user` com `{ site_id: "MLB" }` usando o `mpAccessToken`
2. Retorna o `email` do test user criado pela API
3. Se a criação falhar, usa fallback `test_user_{timestamp}@testuser.com` (tentativa)
4. Em produção, mantém comportamento atual (email real ou fallback `@pedido.com`)

Essa é a forma oficial do MP para gerar pagadores válidos no sandbox — cada chamada cria um test user efêmero cujo email é aceito pela API.

