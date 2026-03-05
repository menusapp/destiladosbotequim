

## Plano: Login com seleção de papel (CEO/Dev) + melhorias nos painéis

### 1. Tela de Login (`AdminPanel.tsx`)

Redesenhar a tela `/admin-panel` para ter **duas etapas**:

**Etapa 1 — Seleção de papel**: Dois botões grandes lado a lado:
- "Login CEO" (icone Crown/Briefcase) — cor dourada/premium
- "Login Dev" (icone Code/Terminal) — cor azul/tech

**Etapa 2 — Formulário de credenciais**: Após clicar, mostra o formulário de email/senha com o título indicando qual papel foi escolhido. Botão "Voltar" para trocar.

Na validação pós-login: verificar se o usuário realmente tem a role selecionada. Se não tiver, mostrar erro "Você não tem acesso como [CEO/Dev]".

### 2. Painel CEO — Melhorias

Expandir o dashboard com mais cards de resumo:
- **Total de Restaurantes** (já existe)
- **MRR (Receita Mensal)** — soma dos planos ativos de `restaurant_subscriptions` + `subscription_plans`
- **Inadimplentes** — assinaturas com `status = 'suspended'` ou `expires_at < now()`
- **Novos este mês** — restaurantes criados no mês atual

Na lista de restaurantes, adicionar colunas:
- **Plano ativo** (buscar de `restaurant_subscriptions` + `subscription_plans`)
- **Status da assinatura** (badge: ativo/suspenso/cancelado)
- **Data de criação**

### 3. Painel Dev — Melhorias

Expandir com mais cards e tabs:
- **Card: Versão Atual** — mostra a versão marcada como `is_current` da tabela `app_versions`
- **Card: Total de Versões** — contagem de `app_versions`
- **Tab: Configurações** — placeholder para futuras configurações remotas
- Melhorar tab de Versões com badge visual para `is_current`

### Componentes afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/AdminPanel.tsx` | Redesenhar com seleção CEO/Dev antes do form |
| `src/pages/CEODashboard.tsx` | Adicionar cards MRR, inadimplentes, novos; expandir lista restaurantes com plano/status |
| `src/pages/DevDashboard.tsx` | Adicionar cards versão atual e total; tab configurações |

### Sem mudanças no banco

Todas as tabelas necessárias já existem (`subscription_plans`, `restaurant_subscriptions`, `app_versions`). Apenas consultas novas no frontend.

