

## Plano: Botão de sair no perfil + Navegação de categorias inteligente

### 1. Botão "Sair" na aba Perfil (delivery)

**Arquivo: `src/components/menu/ProfileView.tsx`**
- Adicionar prop `onLogout` (callback)
- Adicionar botão "Sair da conta" no final da página, com ícone `LogOut`, estilo destrutivo
- Ao clicar, limpa `sessionStorage` (customer, cpf, phone) e chama `onLogout`

**Arquivo: `src/pages/DeliveryMenu.tsx`**
- Criar função `handleLogout` que:
  - Remove `delivery-customer-{slug}`, `delivery-cpf-{slug}`, `delivery-phone-{slug}` do sessionStorage
  - Remove `delivery-cart-{slug}` do localStorage
  - Limpa estados (`customerName`, `customerCPF`, `cart`)
  - Reabre o diálogo de identificação (`setShowCustomerDialog(true)`)
  - Volta para aba "menu"
- Passar `onLogout={handleLogout}` para `<ProfileView>`

### 2. Navegação de categorias com scroll spy (IntersectionObserver)

**Arquivos: `src/components/menu/CategoryProducts.tsx` e `src/components/menu/CategoryNav.tsx`**

Ambos os componentes têm o mesmo padrão de navegação de categorias. A mudança é idêntica nos dois:

- Adicionar `useEffect` com `IntersectionObserver` que observa cada `div#category-{id}`
- Quando uma seção entra na viewport (threshold ~0.3, rootMargin no topo), atualiza `activeCategory` automaticamente
- O botão de categoria ativa faz scroll horizontal automático para ficar visível (usando `scrollIntoView` no próprio botão via `ref`)
- Manter o click-to-scroll existente funcionando normalmente
- Adicionar flag `isManualScroll` para evitar conflito entre clique e observer durante o scroll programático

**Resultado**: conforme o usuário rola a página, a pílula ativa na barra de categorias acompanha automaticamente. Clicar numa categoria continua scrollando até ela.

