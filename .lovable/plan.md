## Problema

Atualmente o cadastro falha com "Este nome de usuário já está em uso" mesmo quando o username existe apenas em **outro** restaurante. Isso acontece porque:

1. A tabela `restaurant_credentials` tem constraint **UNIQUE (username)** — global, não por restaurante.
2. A edge function `register-restaurant` faz check de username sem filtrar por `restaurant_id`.

A regra correta: username deve ser único **dentro do mesmo restaurante**, mas pode se repetir entre restaurantes diferentes.

Bônus: a tabela `restaurant_staff` já está correta (`UNIQUE (restaurant_id, username)`), então a correção é apenas em `restaurant_credentials` e na função RPC de login.

## Mudanças

### 1. Migration no banco

- Remover constraint `restaurant_credentials_username_key` (UNIQUE global em `username`).
- Criar nova constraint `UNIQUE (restaurant_id, username)`.
- Atualizar a função `validate_restaurant_credentials(p_username, p_password)` para iterar por **todos** os registros com aquele username e validar a senha (bcrypt) em cada um, retornando o primeiro match. Isso é necessário porque o login do restaurante (`/login`) só pede username + senha, sem slug. Como a senha é hashed com bcrypt (salt único), é impossível dois restaurantes terem o mesmo username + mesmo hash, então o match por senha é seguro.

```sql
-- Trocar unique
ALTER TABLE public.restaurant_credentials
  DROP CONSTRAINT restaurant_credentials_username_key;

ALTER TABLE public.restaurant_credentials
  ADD CONSTRAINT restaurant_credentials_restaurant_username_key
  UNIQUE (restaurant_id, username);

-- Atualizar RPC para iterar
CREATE OR REPLACE FUNCTION public.validate_restaurant_credentials(...)
-- FOR rec IN SELECT ... WHERE username = p_username LOOP
--   IF crypt(p_password, rec.password_hash) = rec.password_hash THEN RETURN; END IF;
-- END LOOP;
```

### 2. Edge function `register-restaurant`

Trocar o check de unicidade do username para considerar `(restaurant_id, username)`. Como o restaurante ainda não foi criado nesse momento, a validação deixa de fazer sentido como pré-check global e passa a confiar na constraint composta do banco — basta remover o pré-check de username e deixar o erro de constraint aparecer (improvável, pois o restaurante é novo). Mantém-se o pré-check de slug, que continua sendo global.

### 3. Sem mudanças no frontend

`RestaurantLogin.tsx` continua chamando o mesmo RPC, agora com lógica corrigida. Nenhuma outra tela precisa mudar.

## Arquivos afetados

- `supabase/functions/register-restaurant/index.ts` — remover pré-check de username
- Migration SQL — trocar constraint + atualizar RPC `validate_restaurant_credentials`

## O que NÃO muda

- Não altero fluxos de pedidos, cardápio, iFood, Delivery Direto, fiscal.
- Staff login continua igual (já estava correto).
- Slug continua sendo único globalmente.
