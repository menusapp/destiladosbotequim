

# Plan: Revisão de Segurança, Performance e Estabilidade para Produção

## Resumo da auditoria

Após análise completa do código, a situação atual é:
- **RLS**: Todas as 77 tabelas têm RLS ativado, porém TODAS usam políticas `USING (true) / WITH CHECK (true)` — acesso totalmente aberto. Isso é intencional dado que o sistema usa autenticação via `localStorage` (anon role), mas tabelas sensíveis de outros restaurantes ficam expostas.
- **Secrets hardcoded**: Nenhuma chave privada hardcoded no frontend — apenas `SUPABASE_URL` e `ANON_KEY` (correto).
- **Performance**: `staleTime` global de 5 min já configurado. Realtime channels têm cleanup adequado. Sem duplicatas óbvias.
- **Console.logs**: ~370 ocorrências em 12 arquivos (Menu.tsx, Comanda.tsx, Kiosk.tsx, RestaurantAdmin.tsx são os piores).
- **Edge Functions**: Todas têm try/catch e CORS. Boa cobertura de erros.

## Mudanças propostas (cirúrgicas, sem risco)

### 1. Segurança — RLS com escopo por restaurant_id

**PROBLEMA CRÍTICO**: Qualquer usuário anônimo pode ler/escrever em tabelas de QUALQUER restaurante. Na prática, alguém poderia listar pedidos, clientes, configurações fiscais e financeiras de restaurantes concorrentes usando a anon key.

**Abordagem conservadora**: Em vez de criar políticas `restaurant_id = ?` (que quebraria o sistema que opera como anon sem contexto de restaurante), vou documentar este risco como comentários no código e NÃO alterar as políticas RLS. A razão: toda a arquitetura depende de queries client-side com filtro `restaurant_id` e roles `anon`. Mudar RLS agora exigiria refatoração arquitetural completa do sistema de autenticação.

**Ação**: Adicionar comentário de segurança no `client.ts` e no `ProtectedRoute.tsx` documentando este risco para futura refatoração.

### 2. Limpeza — Console.logs de debug (~370 ocorrências)

Remover console.logs de debug em:
- `src/pages/Menu.tsx` (~30 logs com emojis 🔍⭐📦🔒💰)
- `src/pages/Comanda.tsx` (~25 logs com emojis)  
- `src/pages/Kiosk.tsx` (~5 logs)
- `src/pages/RestaurantAdmin.tsx` (~5 logs)
- `src/components/kiosk/KioskPayment.tsx` (~5 logs)
- `src/components/menu/CheckoutDrawer.tsx` (~3 logs)
- `src/components/menu/checkout/PaymentStep.tsx` (1 log)
- `src/components/admin/settings/WhatsAppSettings.tsx` (1 log)
- `src/components/admin/OrderDetailModal.tsx` (1 log)
- `src/hooks/useMenuInactivityLogout.tsx` (2 logs)
- `src/lib/performanceMonitor.ts` (remover auto-print em produção)

Manter todos os `console.error` e `console.warn` (úteis para diagnóstico).

### 3. Performance — Otimização de queries no DeliveryMenu

O `DeliveryMenu.tsx` faz queries sequenciais (restaurante → categorias → produtos destacados). Consolidar com `Promise.all` onde as queries são independentes.

### 4. Estabilidade — Loading states

Verificar e melhorar loading states nos componentes principais que usam fetch direto (sem TanStack Query) e podem ficar em tela branca:
- `DeliveryMenu.tsx`: já tem `loading` state mas não mostra skeleton
- `Kiosk.tsx`: idem

### 5. Formulários — Validação no CreateOrderDrawer

O `CreateOrderDrawer.tsx` permite submeter pedido delivery sem endereço preenchido. Adicionar validação mínima antes do submit.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Menu.tsx` | Remover ~30 console.logs de debug |
| `src/pages/Comanda.tsx` | Remover ~25 console.logs de debug |
| `src/pages/Kiosk.tsx` | Remover ~5 console.logs |
| `src/pages/RestaurantAdmin.tsx` | Remover ~5 console.logs |
| `src/components/kiosk/KioskPayment.tsx` | Remover ~5 console.logs |
| `src/components/menu/CheckoutDrawer.tsx` | Remover ~3 console.logs |
| `src/components/menu/checkout/PaymentStep.tsx` | Remover 1 console.log |
| `src/components/admin/settings/WhatsAppSettings.tsx` | Remover 1 console.log |
| `src/components/admin/OrderDetailModal.tsx` | Remover 1 console.log |
| `src/hooks/useMenuInactivityLogout.tsx` | Remover 2 console.logs |
| `src/lib/performanceMonitor.ts` | Condicionar auto-print a `import.meta.env.DEV` |
| `src/pages/DeliveryMenu.tsx` | Consolidar queries com Promise.all |
| `src/components/admin/CreateOrderDrawer.tsx` | Validação de endereço em pedido delivery |

## O que NÃO muda

- Nenhuma política RLS existente (risco de quebrar fluxos)
- Nenhum fluxo de pedidos, fiscal, iFood, DD, WhatsApp
- Nenhuma Edge Function
- Nenhum schema de banco
- Nenhum canal realtime
- Login do restaurante, staff e CEO

## Risco documentado (sem ação agora)

As políticas RLS `USING (true)` permitem que qualquer pessoa com a anon key acesse dados de qualquer restaurante. Isso é uma limitação arquitetural do sistema de autenticação baseado em localStorage. A correção exigiria migrar para Supabase Auth com custom claims ou implementar um middleware de validação. Será documentado no código.

