

## Plano: Trocar fonte para Outfit e melhorar hierarquia visual

### Mudancas

**1. Importar fonte Outfit**
- Em `src/index.css`: trocar o import do Google Fonts de `Inter` para `Outfit` (pesos 300-700)

**2. Atualizar config de fonte**
- Em `tailwind.config.ts`: trocar `Inter` por `Outfit` no `fontFamily.sans`
- Em `src/index.css`: trocar `font-family` no `html` para `Outfit`

**3. Melhorar hierarquia visual na Landing Page**
- Titulos principais (h1, h2): manter `font-extrabold` mas ajustar `letter-spacing` para `-0.025em` (mais apertado, visual premium)
- Subtitulos/descricoes: usar `font-normal` com tamanho um pouco maior (`text-base` -> `text-lg` onde faz sentido)
- Labels/badges: manter `text-xs font-semibold uppercase tracking-wider`
- Cards: titulos `font-semibold` (ao inves de `font-bold`), descricoes `font-light` para contraste
- CTAs/botoes: manter `font-bold`/`font-semibold`

### Arquivos
- **Editar:** `src/index.css` (import da fonte)
- **Editar:** `tailwind.config.ts` (font family)
- **Editar:** `src/pages/LandingPage.tsx` (ajustes de hierarquia nos pesos e tracking)

