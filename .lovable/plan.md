

## Plano: Corrigir Rotas Quebradas + Redesign Landing Page

### Parte 1: Rotas Quebradas

Encontrei 3 referências quebradas:

| Arquivo | Rota antiga | Correção |
|---|---|---|
| `RestaurantAdmin.tsx` (linha 149) | `/staff-login` | `/login/staff` |
| `RestaurantAdmin.tsx` (linha 507) | `/staff-login` | `/login/staff` |
| `Auth.tsx` (linhas 28, 35) | `/admin` | Precisa do slug — redirecionar para `/${slug}/admin` |
| `MercadoPagoCallback.tsx` (linhas 26, 61) | `/admin` | Precisa do slug — usar `localStorage.getItem('restaurant_slug')` |

**Auth.tsx** e **MercadoPagoCallback.tsx** usam `/admin` que não existe mais — precisam construir a URL com o slug do localStorage.

---

### Parte 2: Redesign Completo da Landing Page

A landing page atual é básica demais. Vou reconstruir `LandingPage.tsx` com um design agressivo e profissional, estilo SaaS moderno:

**Estrutura (seções):**

1. **Header** — Logo + nav sticky com blur, botão "Entrar no Painel"
2. **Hero** — Headline impactante, subtítulo curto, CTA grande com gradiente, badge "Sistema completo"
3. **Números/Social proof** — Estatísticas em linha (ex: "500+ restaurantes", "1M+ pedidos")
4. **Funcionalidades principais** — Grid 3x3 com ícones e descrições curtas:
   - Cardápio Digital com QR Code
   - Pedidos Online (delivery + retirada)
   - PDV e Balcão
   - Gestão de Mesas + Reservas
   - Estoque Automático + CMV
   - Relatórios, DRE, Fluxo de Caixa
   - Nota Fiscal Eletrônica
   - CRM + Programa de Fidelidade
   - Marketing WhatsApp + Remarketing
5. **Showcase visual** — Seção com mockup/descrição detalhada de 3-4 features principais com alternância esquerda/direita
6. **Planos e Preços** — 3 cards (Básico R$99, Profissional R$199, Completo R$349) com destaque no do meio
7. **FAQ** — Accordion com perguntas frequentes
8. **CTA Final** — Seção de chamada final com fundo destacado
9. **Footer** — Links, copyright

**Design:**
- Animações suaves com CSS (fade-in ao scroll via Intersection Observer, hover scale nos cards)
- Gradientes sutis no hero (laranja para transparente)
- Cards com hover shadow e transição
- Espaçamento generoso, tipografia grande no hero
- Mobile-first e totalmente responsivo
- Identidade laranja (#FF6B00) como cor de destaque

**Arquivos:**
- **Editar:** `src/pages/LandingPage.tsx` — redesign completo
- **Editar:** `src/pages/RestaurantAdmin.tsx` — fix `/staff-login` → `/login/staff`
- **Editar:** `src/pages/Auth.tsx` — fix `/admin` → `/${slug}/admin`
- **Editar:** `src/pages/MercadoPagoCallback.tsx` — fix `/admin` → `/${slug}/admin`

