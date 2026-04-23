

# Personalização de Marca do Cardápio Digital

Vou implementar três melhorias para deixar o cardápio digital com a cara do restaurante (e não do Menu's):

## 1. Favicon dinâmico do restaurante

Hoje o favicon é fixo (logo do Menu's no `index.html`). Vou criar um componente que injeta dinamicamente o favicon usando o `logo_url` que o restaurante já cadastra em **Configurações → Dados da Empresa**.

**Como vai funcionar:**
- Quando o cliente abrir `menusapp.com.br/rods` (ou subdomínio `rods.menusapp.com.br`), o sistema busca o `logo_url` do restaurante e troca o `<link rel="icon">` em runtime
- Aba do navegador mostra a logo do restaurante + nome dele no `<title>`
- Aplica em todas as rotas públicas do cliente: `/:slug`, `/:slug/mesa/:n`, `/:slug/comanda/:n`, `/:slug/kiosk`, `/:slug/reservas`, `/:slug/pedido/:id`
- Rotas administrativas (`/admin`, `/login`, `/ceo`) mantêm o favicon do Menu's

## 2. Link preview WhatsApp já está pronto — só falta usar

A edge function `menu-link-preview` **já existe** e renderiza meta tags Open Graph com a logo do restaurante. O problema é que ninguém está usando ela hoje — os links compartilhados apontam direto pra `menusapp.com.br/slug`, que serve o `index.html` global com a logo do Menu's.

**Solução:**
- Criar um helper `getShareableMenuLink(slug)` que retorna a URL da edge function:
  `https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/menu-link-preview/<slug>`
- Usar esse helper em todos os lugares que geram link pra compartilhar (botão "Copiar link do cardápio", QR Code, mensagens automáticas do WhatsApp, etc.)
- Quando o WhatsApp/Facebook fizer scraping dessa URL, vai pegar a logo + nome do restaurante. Quando o usuário clicar, é redirecionado pro cardápio normal

## 3. Subdomínio personalizado por restaurante

A infra de wildcard DNS (`*.menusapp.com.br`) já está configurada na VPS conforme memória do projeto, e o `slugResolver.ts` já detecta subdomínio. O que falta é a **UX para o restaurante ativar e divulgar isso**.

**O que vou adicionar:**
- Nova seção em **Configurações → Dados da Empresa** chamada "**Link do seu cardápio**"
- Mostra os dois formatos disponíveis lado a lado:
  - Padrão: `menusapp.com.br/rods/menus`
  - Subdomínio: `rods.menusapp.com.br/menus`
- Botão "Copiar link" em cada um
- O restaurante escolhe qual divulgar (subdomínio é mais bonito/curto)
- Aceitar rota `/menus` como alias de `/:slug` (ou seja, `rods.menusapp.com.br/menus` abre o cardápio delivery direto)

**Importante:** Não vou implementar compra de subdomínio próprio do restaurante (`rodscompany.com.br`) — isso exigiria comprar domínio. Vou usar apenas o wildcard que já existe.

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/hooks/useDynamicFavicon.ts` — hook que troca `<link rel="icon">` e `<title>` baseado no restaurante
- `src/lib/shareableLinks.ts` — helper centralizado com `getShareableMenuLink(slug)` e `getDirectMenuLink(slug)`
- `src/components/admin/settings/ShareableLinksSection.tsx` — UI dos links com botão copiar

**Arquivos a editar:**
- `src/pages/Menu.tsx`, `DeliveryMenu.tsx`, `Comanda.tsx`, `Kiosk.tsx`, `Reservations.tsx`, `OrderConfirmation.tsx` — usar `useDynamicFavicon`
- `src/components/admin/settings/CompanyDataSettings.tsx` — incluir nova seção `ShareableLinksSection`
- `src/App.tsx` — adicionar rota `/:slug/menus` apontando pra `DeliveryMenu` (alias)
- Substituir lugares que geram link pro cliente (busca por `menusapp.com.br/${slug}`) pelo helper novo, pra preview do WhatsApp funcionar

**Lógica central:**
- Favicon: `useDynamicFavicon(logoUrl, restaurantName)` manipula `document.head` direto. Restaura favicon original no unmount.
- Subdomínio: já resolvido em `src/lib/slugResolver.ts`, sem mudança necessária.
- Link preview: edge function `menu-link-preview` já está pronta, só passa a ser referenciada.

**Não vou mexer:**
- `index.html` global (favicon padrão Menu's continua para landing/admin/login)
- Edge function `menu-link-preview` (já está completa)
- Configuração de DNS/Nginx da VPS

