

## Plano: Reestruturação de Rotas + Landing Page Comercial

### Nova Estrutura de URLs

```text
menusapp.com.br/                    → Landing page comercial (planos, features)
menusapp.com.br/login               → Login do restaurante (atual Landing)
menusapp.com.br/login/staff         → Login do staff (atual StaffLogin)
menusapp.com.br/admin-panel         → Login CEO/Dev (sem mudança)
menusapp.com.br/admin-panel/ceo     → Painel CEO
menusapp.com.br/admin-panel/dev     → Painel Dev

menusapp.com.br/:slug               → Cardápio delivery (atual DeliveryMenu)
menusapp.com.br/:slug/mesa/:numero  → Cardápio local/mesa (atual Menu)
menusapp.com.br/:slug/comanda/:num  → Comanda da mesa (atual Comanda)
menusapp.com.br/:slug/pedido/:id    → Confirmação de pedido
menusapp.com.br/:slug/reservas      → Reservas
menusapp.com.br/:slug/admin         → Painel admin do restaurante
menusapp.com.br/:slug/admin/mesa/:id → Detalhe mesa (admin)
```

**Futuro VPS (subdomínio):**
```text
rods.menusapp.com.br/               → Cardápio delivery
rods.menusapp.com.br/mesa/1         → Mesa 1
rods.menusapp.com.br/admin          → Painel admin
```

### 1. Landing Page Comercial (NOVO)

Nova página `src/pages/LandingPage.tsx` — página de vendas do Menu's:
- Hero section com headline, subtítulo e CTA
- Seção de features/benefícios (cardápio digital, pedidos, delivery, gestão)
- Seção de planos/preços (3 cards: Básico, Intermediário, Completo) — botões de compra como placeholder por agora
- Seção de depoimentos/social proof
- Footer com links
- Design profissional com a identidade laranja (#FF6B00)
- Totalmente responsivo (mobile-first)

### 2. Reestruturação de Rotas (`App.tsx`)

Mover as rotas existentes para a nova estrutura:

| Rota antiga | Rota nova |
|---|---|
| `/` (login restaurante) | `/login` |
| `/staff-login` | `/login/staff` |
| `/admin` | `/:slug/admin` |
| `/admin/table/:tableId` | `/:slug/admin/mesa/:tableId` |
| `/delivery/:restaurantSlug` | `/:slug` |
| `/menu/:restaurantSlug/:tableNumber` | `/:slug/mesa/:tableNumber` |
| `/comanda/:restaurantSlug/:tableNumber` | `/:slug/comanda/:tableNumber` |
| `/delivery/:restaurantSlug/pedido/:orderId` | `/:slug/pedido/:orderId` |
| `/reservas/:restaurantSlug` | `/:slug/reservas` |

**Importante:** A rota `/:slug` é um catch-all dinâmico — precisa ficar DEPOIS das rotas fixas (`/login`, `/admin-panel`) para não conflitar.

### 3. Adaptar Componentes para Novas Rotas

**Páginas que usam `useParams` para `restaurantSlug`:**
- `DeliveryMenu.tsx` — mudar param de `restaurantSlug` para `slug`
- `Menu.tsx` — mudar param de `restaurantSlug` para `slug`  
- `Comanda.tsx` — mudar param de `restaurantSlug` para `slug`
- `OrderConfirmation.tsx` — mudar param
- `Reservations.tsx` — mudar param

**Páginas de admin:**
- `RestaurantAdmin.tsx` — agora recebe `:slug` da URL, busca restaurant por slug em vez de localStorage (ou valida que o slug bate com o localStorage)
- `Landing.tsx` → renomear para `RestaurantLogin.tsx`, redirecionar para `/login/staff` após login
- `StaffLogin.tsx` — redirecionar para `/:slug/admin` após login (usando slug do localStorage)

**Navegação interna:**
- `AdminHeader.tsx` — links de logout para `/login`
- `AppSidebar.tsx` — se tiver links internos, ajustar
- Componentes de checkout/delivery — ajustar links de confirmação de pedido

### 4. Helper de Subdomínio (preparação VPS)

Criar `src/lib/slugResolver.ts`:
- Função `getSlugFromURL()` que verifica:
  1. Se há subdomínio (ex: `rods.menusapp.com.br`) → retorna `rods`
  2. Senão, retorna o slug do path da URL
- Usado pelos componentes públicos para resolver o restaurante
- No Lovable funciona por path; na VPS funciona por subdomínio automaticamente

### Arquivos

- **Criar:** `src/pages/LandingPage.tsx` (landing comercial)
- **Criar:** `src/lib/slugResolver.ts` (helper subdomínio)
- **Renomear/Editar:** `src/pages/Landing.tsx` → `src/pages/RestaurantLogin.tsx`
- **Editar:** `src/App.tsx` (rotas)
- **Editar:** `src/pages/StaffLogin.tsx` (redirect)
- **Editar:** `src/pages/RestaurantAdmin.tsx` (slug na URL)
- **Editar:** `src/pages/DeliveryMenu.tsx` (param slug)
- **Editar:** `src/pages/Menu.tsx` (param slug)
- **Editar:** `src/pages/Comanda.tsx` (param slug)
- **Editar:** `src/pages/OrderConfirmation.tsx` (param slug)
- **Editar:** `src/pages/Reservations.tsx` (param slug)
- **Editar:** `src/components/admin/AdminHeader.tsx` (links)
- **Editar:** `src/components/ProtectedRoute.tsx` (ajustar redirect)

