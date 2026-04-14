

## Plano: Corrigir Rastreamento de Carrinhos Abandonados usando dados do localStorage

### Resumo

O sistema já salva no localStorage (os "cookies" que você mencionou) o nome, CPF, telefone e tempo de expiração do cliente logado. Vamos aproveitar esses dados para enriquecer automaticamente as sessões de rastreamento, corrigir as duplicatas, e agendar a marcação automática de abandono.

### O que muda para o usuário

- O painel de Marketing > Rastreamento vai mostrar corretamente os carrinhos abandonados com nome, telefone e itens do carrinho
- Sessões com carrinho inativo há mais de 30 minutos já aparecem como "potencialmente abandonadas" (sem esperar o cron)
- A cada 30 minutos, sessões paradas há 2+ horas são marcadas definitivamente como abandonadas
- O cardápio de mesa (Menu.tsx) também passa a rastrear sessões

### Mudanças por arquivo

**1. Migration SQL — Limpar duplicatas + UNIQUE constraint**
- Deletar linhas duplicadas da `customer_sessions` (manter apenas a mais recente por `session_token` + `restaurant_id`)
- Adicionar `UNIQUE(session_token, restaurant_id)`
- Habilitar extensões `pg_cron` e `pg_net`

**2. Inserção SQL (via insert tool) — Agendar cron job**
- Criar cron job que chama `process-abandoned-carts` a cada 30 minutos

**3. `src/hooks/useSessionTracking.ts` — Reescrever com upsert**
- Substituir o padrão update-then-insert por `upsert` com `onConflict: 'session_token,restaurant_id'`
- Na sessão inicial ("browsing"), NÃO zerar `cart_items`/`cart_value` — apenas atualizar `last_activity`
- Ler automaticamente do localStorage o nome, CPF e telefone do cliente (usando as chaves `delivery-customer-{slug}`, `delivery-cpf-{slug}`, `delivery-phone-{slug}`) e incluir na sessão
- Aceitar `restaurantSlug` como parâmetro adicional para poder ler os dados do localStorage

**4. `src/pages/DeliveryMenu.tsx` — Passar slug ao hook**
- Passar `restaurantSlug` para o `useSessionTracking` para que ele leia os dados do localStorage do cliente logado

**5. `src/pages/Menu.tsx` — Adicionar rastreamento**
- Importar e usar `useSessionTracking` para capturar sessões do cardápio de mesa

**6. `src/components/admin/marketing/TrackingTab.tsx` — Mostrar sessões potencialmente abandonadas**
- Além de `status = 'abandoned'`, buscar também sessões com `status IN ('cart_added', 'checkout_started')` inativas há mais de 30 minutos
- Mostrar essas sessões com badge "Potencial" vs "Abandonado"
- Incluir na métrica de valor total

**7. `supabase/functions/process-abandoned-carts/index.ts` — Sem mudanças significativas**
- Já funciona corretamente, só precisa ser agendado (passo 2)

### Detalhes técnicos

- Os dados do localStorage (`delivery-customer-{slug}`, `delivery-phone-{slug}`) são lidos pelo hook e enviados junto com cada upsert, garantindo que a sessão sempre tenha os dados do cliente quando ele está logado
- O `session_token` permanece no localStorage indefinidamente (não expira), o que é correto — é o identificador da sessão do navegador
- O upsert usa `onConflict: 'session_token,restaurant_id'` para garantir uma única linha por sessão/restaurante
- O cron job usa `pg_cron` + `pg_net` para chamar a edge function automaticamente

