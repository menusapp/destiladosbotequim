

## Plano: Fluxo de Assinatura Paga com Controle de Inadimplência

### Resumo do fluxo

```text
Usuário clica "Escolher este plano"
         │
         ▼
  /registro/basico (ou intermediario/avancado)
  Formulário: nome, slug, usuário, senha
         │
         ▼
  register-restaurant cria restaurante
  com subscription status = "pending_payment"
         │
         ▼
  Redireciona para Mercado Pago
  (preapproval_plan com external_reference = restaurant_id)
         │
         ▼
  Usuário paga no MP → MP envia webhook
         │
         ▼
  mercadopago-subscription-webhook recebe
  Ativa subscription (status = "active")
         │
         ▼
  Usuário volta via back_url → /{slug}/admin
  (auto-login via localStorage já salvo)
```

---

### Alterações

**1. Migration SQL — nova coluna + ajuste**

- Adicionar `pending_plan_slug text` na tabela `restaurants` (para saber qual plano o restaurante comprou antes do webhook chegar)
- Adicionar `failed_payments integer default 0` na tabela `restaurant_subscriptions` (contador de cobranças negadas)

**2. `supabase/functions/register-restaurant/index.ts`**

- Para planos pagos (`basico`, `intermediario`, `avancado`):
  - Criar restaurante com `pending_plan_slug = planSlug`
  - Criar credentials e staff (como já faz)
  - Criar subscription com `status = "pending_payment"` (não "active")
  - Retornar no response: `{ restaurantId, slug, redirectUrl }` onde `redirectUrl` é o link do MP com `external_reference=restaurantId` como query param
- Para `trial`: manter comportamento atual (subscription active imediata)

**3. `src/pages/LandingPage.tsx`**

- Mudar o `onClick` dos planos pagos: em vez de `window.open(mpLink)`, navegar para `/registro/basico`, `/registro/intermediario`, `/registro/avancado`
- Manter os mpLinks nos dados dos planos (serão usados pelo backend para montar redirect)

**4. `src/pages/RestaurantRegistration.tsx`**

- Adicionar `basico`, `intermediario`, `avancado` ao `planDisplayMap`
- Após registro bem-sucedido de plano pago:
  - Salvar credenciais no localStorage (auto-login)
  - Se `res.data.redirectUrl` existe, redirecionar para o MP (em vez de ir pro admin)
  - Tela de sucesso diferente para plano pago: "Estamos te redirecionando para o pagamento..."
- Após registro de trial: manter comportamento atual (redireciona pro admin)

**5. `supabase/functions/mercadopago-subscription-webhook/index.ts`**

- No handler de `subscription_preapproval.updated/created` com status `authorized/active`:
  - Já busca restaurante por `external_reference` (restaurant_id) ✓
  - Mudar subscription de `pending_payment` para `active` (em vez de inserir nova)
  - Setar `last_payment_at`, `next_payment_at` (+30 dias)
  - Resetar `failed_payments = 0`

- No handler de `subscription_authorized_payment.created` / `payment`:
  - Se pagamento `approved`: atualizar `next_payment_at`, resetar `failed_payments = 0`
  - Se pagamento `rejected`/`refunded`: incrementar `failed_payments`
  - Se `failed_payments >= 2`: mudar status para `suspended`

- Novo handler para `subscription_preapproval.paused`:
  - Já existe, muda para `suspended` ✓

**6. `src/hooks/useRestaurantModules.ts`**

- Tratar `status = "pending_payment"` como sem assinatura ativa (já funciona: só busca `status = active`)
- Tratar `status = "suspended"` como inadimplente (já lida: `hasActiveSubscription = false`)
- Nenhuma mudança necessária aqui

**7. `src/components/admin/BlockedOverlay.tsx`**

- Adicionar variante `reason = "payment_pending"`: "Aguardando confirmação do pagamento. Se já pagou, aguarde alguns minutos."
- Adicionar variante `reason = "delinquent"`: "Sua assinatura foi suspensa por falta de pagamento."
- Ambos com botão para link de pagamento do MP

**8. Nova rota: `/pagamento-pendente/:slug`** (opcional, melhoria UX)

- Página simples que o `back_url` do MP pode apontar
- Verifica se a subscription já foi ativada pelo webhook
- Se sim: redireciona para `/{slug}/admin`
- Se não: mostra "Estamos processando seu pagamento..." com polling a cada 5s

---

### Controle de inadimplência — resumo

| Evento MP | Ação no sistema |
|-----------|----------------|
| Preapproval `authorized`/`active` | Subscription → `active`, `failed_payments = 0` |
| Payment `approved` | `next_payment_at += 30d`, `failed_payments = 0` |
| Payment `rejected` | `failed_payments += 1` |
| `failed_payments >= 2` | Subscription → `suspended` |
| Preapproval `cancelled` | Subscription → `suspended` |
| Restaurante com subscription `suspended` | Painel bloqueado com overlay |

---

### Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar `pending_plan_slug`, `failed_payments` |
| `register-restaurant/index.ts` | Status `pending_payment` para planos pagos |
| `mercadopago-subscription-webhook/index.ts` | Ativar plano, contar falhas, suspender |
| `LandingPage.tsx` | Redirecionar para `/registro/:plan` |
| `RestaurantRegistration.tsx` | Redirect para MP após registro pago |
| `BlockedOverlay.tsx` | Variantes pagamento pendente e inadimplente |
| Nova página `PaymentPending.tsx` (opcional) | Polling de confirmação |

### O que NÃO muda
- Fluxo trial (7 dias grátis)
- Pagamentos no Point/Kiosk
- iFood, Delivery Direto, fiscal
- Cardápio público
- Estrutura do painel admin

