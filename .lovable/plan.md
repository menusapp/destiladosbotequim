## Análise: o que aplicar e o que descartar

Auditei cada item do plano sugerido contra o código atual. Resultado:

| # | Item proposto | Aplicar? | Motivo |
|---|---|---|---|
| 1 | Extrair notificações para `useAdminNotifications.ts` | **Não** | Refatoração puramente cosmética (~400 linhas movidas), zero ganho funcional, alto risco de regressão em fluxo crítico (pedidos/contas/reservas em tempo real). Não vale o risco. |
| 2 | Filtro `restaurant_id` no canal de reservations | **Sim** | Bug real confirmado: `new-reservations-notification` não tem `filter` no binding — recebe eventos de todos os restaurantes e filtra só no JS. Mesma classe de bug das Correções 1 anteriores. |
| 3 | `handleLogout` usar `clearAdminSession()` | **Sim** | Bug real: o handler atual remove só 4 chaves de staff, esquece `restaurant_id`, `restaurant_name`, `restaurant_slug`, `staff_can_manage_orders`, `staff_receives_order_notifications` e o timestamp de expiração. `clearAdminSession()` já existe em `sessionExpiry.ts` e cobre tudo. |
| 4 | Stale closure no `setInterval` de auto open/close | **Sim** | Bug real: o `setInterval` captura `restaurant` no momento da criação. Embora as deps reincluam `restaurant?.id`, mudanças em outros campos (`opening_hours`, `auto_open_close` toggles intermediários) não recriam o intervalo, e a função `checkAndUpdateOpenStatus` é chamada com snapshot antigo. Ref resolve. |
| 5 | Mover `prefetchMap` e `TabSkeleton` para fora do componente | **Sim (parcial)** | `prefetchMap` é um objeto recriado a cada render — fácil mover. `TabSkeleton` vou conferir se existe; se sim, mover junto. Ganho pequeno mas grátis. |
| 6 | Corrigir `useAuth.signOut` → `/login` | **Não** | `useAuth.tsx` **não é importado em nenhum lugar do projeto** (rg confirmou: zero usos fora do próprio arquivo). É código morto. Mexer só adiciona ruído. |

## O que vai ser feito

### 1. `src/pages/RestaurantAdmin.tsx` — 3 correções pontuais

**1a.** Adicionar `filter: restaurant_id=eq.${restaurantId}` ao canal `new-reservations-notification` (renomear para `new-reservations-${restaurantId}` por consistência com Correção 1 anterior). Manter a verificação JS como segunda camada.

**1b.** Substituir o corpo do `handleLogout` por:
```ts
import { clearAdminSession } from "@/lib/sessionExpiry";

const handleLogout = () => {
  clearAdminSession();
  toast.success("Logout realizado com sucesso");
  navigate("/login/staff");
};
```

**1c.** Corrigir stale closure do auto open/close:
```ts
const restaurantRef = useRef(restaurant);
useEffect(() => { restaurantRef.current = restaurant; }, [restaurant]);

useEffect(() => {
  if (!restaurant?.auto_open_close) return;
  const interval = setInterval(() => {
    if (restaurantRef.current) checkAndUpdateOpenStatus(restaurantRef.current);
  }, 60_000);
  return () => clearInterval(interval);
}, [restaurant?.id, restaurant?.auto_open_close, checkAndUpdateOpenStatus]);
```

**1d.** Mover `prefetchMap` (e `TabSkeleton` se existir) para o escopo do módulo, antes da definição do componente.

### 2. Arquivos NÃO alterados

- `src/hooks/useAuth.tsx` — código morto, não tocar.
- Nenhum hook novo (`useAdminNotifications.ts`) será criado — refatoração descartada por risco/benefício ruim.
- Banco de dados: zero mudanças.

## Notas

- Tudo é frontend, sem migração.
- Mantém 100% do comportamento atual de notificações, sons, fila e cascata — apenas conserta vazamento cross-tenant em reservas, logout incompleto, stale closure no relógio de abertura/fechamento, e um micro-ganho de performance.
