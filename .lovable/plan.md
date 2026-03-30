

# Plano — PWA Instalável (sem Service Worker)

## Abordagem: Manifest-only (sem risco)

Conforme as diretrizes do projeto, **não usaremos `vite-plugin-pwa` nem Service Worker**. Isso evita qualquer problema de cache stale, interferência com preview do Lovable, ou quebra de funcionalidades existentes (realtime, fiscal, iFood, MercadoPago, impressão).

Um simples `manifest.json` com `display: "standalone"` já torna o app **instalável** no celular e desktop — sem offline, mas com zero risco de quebrar algo.

## Nenhuma funcionalidade será afetada

- Realtime/subscriptions: sem alteração
- Pedidos, fiscal, iFood, impressão: sem alteração
- MercadoPago SDK: continua carregando normalmente
- Rotas e navegação: sem alteração
- Supabase queries: sem cache de SW, dados sempre frescos

## Alterações

### 1. Criar `public/manifest.json`
```json
{
  "name": "Menu's",
  "short_name": "Menus",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#F97316",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/logo-menus.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/logo-menus.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
Usará o `logo-menus.png` existente no `/public`.

### 2. Atualizar `index.html`
Adicionar no `<head>`:
- `<link rel="manifest" href="/manifest.json">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<meta name="theme-color" content="#F97316">`
- `<link rel="apple-touch-icon" href="/logo-menus.png">`

### 3. Criar `src/components/InstallPWA.tsx`
Componente que:
- Escuta o evento `beforeinstallprompt` (Android/Desktop Chrome)
- Mostra um banner discreto "Instalar aplicativo" com botão
- Em iOS, detecta via `navigator.standalone` e mostra instrução: "No Safari, toque em Compartilhar → Adicionar à Tela de Início"
- Dismissível pelo usuário (salva no localStorage)

### 4. Integrar o componente
- Renderizar `<InstallPWA />` no `App.tsx` (fora das rotas, visível globalmente)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `public/manifest.json` | Criar |
| `index.html` | Adicionar meta tags PWA |
| `src/components/InstallPWA.tsx` | Criar |
| `src/App.tsx` | Adicionar `<InstallPWA />` |

Nenhum arquivo existente terá lógica alterada. Apenas adições.

