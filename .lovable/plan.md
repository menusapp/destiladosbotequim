

# Páginas de Registro por Plano + Controle de Inadimplência

## Resumo

Criar 3 páginas ocultas de registro (uma por plano), acessíveis apenas via redirecionamento do Mercado Pago após pagamento aprovado. Cada página cria o restaurante já vinculado ao plano correspondente. Adicionar controle de inadimplência no painel CEO.

## URLs de Redirecionamento para o Mercado Pago

Ao criar os planos de assinatura no Mercado Pago, usar estas URLs como `back_url` (página de redirecionamento após pagamento aprovado):

- **Básico**: `https://menu-mesa-master.lovable.app/registro/basico`
- **Intermediário**: `https://menu-mesa-master.lovable.app/registro/intermediario`
- **Avançado**: `https://menu-mesa-master.lovable.app/registro/avancado`

## Implementação

### 1. Nova página: `src/pages/RestaurantRegistration.tsx`

Uma única página que recebe o plano via parâmetro de rota (`/:planSlug`). Formulário completo com:
- Nome do restaurante
- Slug (URL personalizada) — com validação de unicidade
- CNPJ
- Telefone
- Endereço
- Usuário e Senha de acesso ao admin

Ao submeter:
1. Criar registro na tabela `restaurants` (nome, slug, cnpj, etc.)
2. Criar credenciais na tabela `restaurant_credentials` (usuário + senha com hash via edge function `hash-password`)
3. Buscar o `subscription_plans` correspondente ao plano (pelo nome: Básico/Intermediário/Avançado)
4. Criar `restaurant_subscriptions` com status "active" vinculando restaurante ao plano
5. Redirecionar para a tela de login

### 2. Rotas no `App.tsx`

Adicionar 3 rotas antes do catch-all `/:slug`:
```
/registro/basico
/registro/intermediario
/registro/avancado
```

### 3. Landing Page — Botões dos Planos

Alterar os botões CTA de cada plano para abrir o link externo do Mercado Pago (por enquanto, usar `href="#"` com um placeholder — o usuário vai substituir pelos links reais do MP quando criar os planos).

### 4. Controle de Inadimplência — Painel CEO

Na aba **Assinaturas** do CEO (`SubscriptionsTab.tsx`):
- Adicionar coluna/indicador visual "Inadimplente" — comparar `next_payment_at` com a data atual
- Se `next_payment_at < hoje` e status = "active", mostrar badge vermelho "Inadimplente"
- Adicionar filtro rápido para ver apenas restaurantes inadimplentes
- Sobre integração automática com MP: como os links de assinatura são gerenciados diretamente no MP, o controle de pagamento fica manual no painel CEO (o operador registra pagamentos). Para automação futura, seria necessário configurar webhooks de assinatura do MP — isso pode ser feito em uma próxima etapa.

### 5. Edge Function para registro (security)

Criar edge function `register-restaurant` que:
- Recebe os dados do formulário
- Faz hash da senha via bcrypt
- Insere restaurant + credentials + subscription em uma transação
- Usa service_role_key (o registro é público, não precisa de auth)
- Valida inputs com Zod

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/RestaurantRegistration.tsx` | **Criar** — formulário de registro |
| `src/App.tsx` | **Editar** — adicionar rotas `/registro/:planSlug` |
| `src/pages/LandingPage.tsx` | **Editar** — botões CTA com links placeholder do MP |
| `src/components/ceo/SubscriptionsTab.tsx` | **Editar** — indicador de inadimplência |
| `supabase/functions/register-restaurant/index.ts` | **Criar** — edge function de registro seguro |

