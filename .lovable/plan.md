

## Plano: Limpeza, Correção de Bugs e Otimização

### Verificação Completa Realizada

Confirmei via `search_files` que **todos os 17 arquivos** são realmente dead code — nenhum é importado em lugar algum do projeto. Cada arquivo só referencia a si mesmo.

Confirmei também os 3 bugs/problemas de performance:
- **`activeSection` stale closure** (linha 253 de RestaurantAdmin.tsx) — usado dentro do callback realtime mas sem `useRef`, então o valor fica stale
- **`lastScrollY` como useState** (Menu.tsx linha 45) — causa re-render a cada scroll event
- **QueryClient sem config** (App.tsx) — sem staleTime/retry = queries refazem a cada foco de janela

---

### 1. Deletar 17 arquivos mortos (~4000 linhas)

| Arquivo | Linhas |
|---|---|
| `src/pages/Auth.tsx` | ~280 |
| `src/components/admin/DashboardTab.tsx` | ~100 |
| `src/components/admin/CMVDashboardTab.tsx` | ~150 |
| `src/components/admin/SettingsTab.tsx` | ~482 |
| `src/components/admin/BalcaoTab.tsx` | ~930 |
| `src/components/admin/OrdersTab.tsx` | ~610 |
| `src/components/admin/DeliveryOrdersTab.tsx` | ~300 |
| `src/components/admin/LocalOrdersTab.tsx` | ~807 |
| `src/components/admin/PedidosTab.tsx` | ~339 |
| `src/components/admin/BillsTab.tsx` | ~721 |
| `src/components/admin/DeliveryTab.tsx` | ~200 |
| `src/components/admin/DRETab.tsx` | ~200 |
| `src/components/admin/CashRegisterTab.tsx` | ~400 |
| `src/components/admin/TableOrdersDrawer.tsx` | ~200 |
| `src/components/NavLink.tsx` | ~25 |
| `src/contexts/RealtimeContext.tsx` | ~55 |
| `src/hooks/useLocalRealtime.ts` | ~225 |

### 2. Corrigir bugs de produção

**App.tsx** — Configurar QueryClient:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});
```

**RestaurantAdmin.tsx** — Fix stale closure do `activeSection`:
- Adicionar `const activeSectionRef = useRef(activeSection)` 
- Sync com `useEffect(() => { activeSectionRef.current = activeSection }, [activeSection])`
- Usar `activeSectionRef.current` nas linhas 253-256 dentro do callback realtime

**Menu.tsx** — Fix scroll re-renders:
- Trocar `const [lastScrollY, setLastScrollY] = useState(0)` por `const lastScrollY = useRef(0)`
- Trocar `setLastScrollY(currentScrollY)` por `lastScrollY.current = currentScrollY`
- Comparações usam `lastScrollY.current`
- Remover `lastScrollY` do array de dependências do useEffect

### 3. Nenhuma mudança de backend

Todas as mudanças são apenas front-end: deletar arquivos não usados, ajustar configs e corrigir closures.

