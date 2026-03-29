

# Fix: Registro de Restaurante + URL + Fluxo de Login

## Problemas Identificados

1. **Edge function falhando silenciosamente** — A função `register-restaurant` crasha sem logs visíveis. Provável causa: o `bcrypt` importado de `deno.land` pode falhar no runtime do Edge Functions. O erro genérico "Erro ao registrar" aparece porque `res.error` é truthy mas `res.data?.error` é undefined.

2. **URL errada** — Linha 173 do `RestaurantRegistration.tsx` mostra `menu-mesa-master.lovable.app/slug` em vez de `menusapp.com.br/slug`.

3. **Redirect pós-registro** — Após cadastro, redireciona para `/login` (correto), onde o dono usa as credenciais que acabou de criar. O fluxo já faz isso, só precisa garantir que funcione.

## Correções

### 1. Edge Function `register-restaurant/index.ts`

- Adicionar `console.log` em pontos-chave para diagnóstico
- Adicionar `console.error` antes de cada return de erro para capturar nos logs
- Tratar o hash de senha com try/catch específico — se bcrypt falhar, logar o erro detalhado
- O bcrypt importa igual ao `hash-password` que já funciona, então o import está OK. Mas adicionar proteção contra crash silencioso.

### 2. Frontend `RestaurantRegistration.tsx`

- **Linha 173**: Trocar `menu-mesa-master.lovable.app/` por `menusapp.com.br/`
- **Tratamento de erro melhorado**: Quando `res.error` existe, extrair a mensagem real do erro (pode estar em `res.error.message` ou no corpo da resposta) em vez de mostrar mensagem genérica
- **Redirect**: Manter `/login` como destino pós-registro — é a tela de login do restaurante onde o dono usa o usuário/senha que acabou de criar

### 3. Fluxo de "Primeiro Login"

O fluxo atual já cobre isso naturalmente:
- Dono preenche usuário + senha no registro → credenciais são salvas na tabela `restaurant_credentials`
- Ao ser redirecionado para `/login`, ele usa essas mesmas credenciais
- O RPC `validate_restaurant_credentials` valida e redireciona para `/login/staff`
- Não é necessário criar uma tela separada de "primeiro login" — o registro JÁ É o primeiro login setup

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/register-restaurant/index.ts` | Adicionar logs detalhados e melhor tratamento de erro |
| `src/pages/RestaurantRegistration.tsx` | Corrigir URL para `menusapp.com.br`, melhorar tratamento de erro |

