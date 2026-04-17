
## Plano: Corrigir Realtime Multi-Tenant

### Problema
Canais Supabase Realtime com nomes genéricos (sem `restaurantId`) podem causar vazamento de eventos entre restaurantes diferentes quando rodando 3+ contas simultâneas. Exemplo: operador do Restaurante A recebe notificação de pedido do Restaurante B.

### Investigação necessária
Vou varrer todos os `supabase.channel(...)` do projeto e identificar quais não incluem `restaurantId` no nome. Já mapeados na auditoria anterior:
- `pdv-tables-rt`
- `menu-changes`
- E outros a confirmar (PendingOrdersPanel, NewOrderNotification, RealtimeStatusIndicator, hooks de polling, etc.)

### Correção (padrão único)
Renomear cada canal para incluir o ID do restaurante:
```ts
// ANTES (vulnerável):
supabase.channel('pdv-tables-rt')

// DEPOIS (isolado):
supabase.channel(`pdv-tables-rt-${restaurantId}`)
```

E no filtro do `.on('postgres_changes', ...)` adicionar `filter: 'restaurant_id=eq.${restaurantId}'` quando a tabela tiver essa coluna, para reduzir tráfego além de garantir isolamento.

### Arquivos prováveis a editar
- `src/components/admin/PDVTab.tsx`
- `src/components/admin/UnifiedOrdersTab.tsx`
- `src/components/admin/PendingOrdersPanel.tsx`
- `src/components/admin/NewOrderNotification.tsx`
- `src/components/admin/NewBillNotification.tsx`
- `src/components/admin/NewReservationNotification.tsx`
- `src/components/admin/TablesTab.tsx`
- `src/components/admin/OverviewTab.tsx`
- `src/components/admin/FluxoCaixaTab.tsx`
- `src/components/menu/*` (cardápio digital — listeners de status de pedido)
- `src/components/kiosk/*` (totem)
- `src/hooks/useRealtimeStatus.ts`
- Outros que aparecerem na busca

(Lista exata será confirmada com `grep` de `supabase.channel(` no momento da execução.)

### O que pode quebrar / efeitos colaterais

**Risco real: BAIXO**, desde que feito com cuidado. Detalhes:

1. **Reconexão automática** — ao mudar nome de canal, clientes já abertos (operadores logados no momento do deploy) precisam recarregar a aba para pegar o novo canal. Sem reload, ficam ouvindo o canal antigo (que ninguém mais publica). **Mitigação:** avisar operadores para dar F5 após o deploy, ou já estará resolvido no próximo login.

2. **Cardápio digital de cliente** — clientes com a aba aberta no momento do deploy também precisam recarregar. Mitigação: refresh natural quando trocam de tela.

3. **Filtros `restaurant_id=eq.X`** — se aplicados em tabelas que não têm essa coluna (raro), o canal não sobe. **Mitigação:** só aplicar filtro em tabelas que comprovadamente têm `restaurant_id` (orders, tables, bills, products, etc.). Tabelas filhas (order_items, order_item_extras) ficarão sem filtro de coluna mas ainda terão isolamento pelo nome do canal.

4. **Notificações de novo pedido / nova mesa / nova reserva** — se o canal antigo era ouvido em múltiplos lugares, todos precisam ser renomeados juntos. Vou garantir busca completa antes de editar.

5. **Não afeta:**
   - Lógica de negócio (criação/edição de pedidos, pagamentos, estoque, fiscal)
   - Banco de dados (zero migrations)
   - Edge functions
   - Autenticação
   - iFood/Delivery Direto polling (não usa realtime)
   - WhatsApp bot

### Plano de execução (3 passos)
1. **Mapear** todos os `supabase.channel(...)` do projeto com `code--search_files`
2. **Renomear** cada canal incluindo `${restaurantId}` e adicionar `filter` quando aplicável
3. **Validar** que cada `useEffect` que cria canal tem `restaurantId` nas dependências e cleanup correto no return

### Esforço
~15-25 arquivos editados, mudanças mecânicas e seguras. ~30 min de trabalho. Zero risco para banco/lógica.

### Recomendação pós-deploy
Pedir para os operadores logados darem F5 uma única vez após o deploy. A partir daí, isolamento garantido.
