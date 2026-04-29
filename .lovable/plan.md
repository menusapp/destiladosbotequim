## Objetivo

Criar 6 landing pages de nicho (Hamburgueria, Pizzaria, Bar, Sushi, Marmitaria, Sorveteria) baseadas na `LandingPage.tsx` existente, com a mesma estrutura/qualidade visual, mas com cópia (textos, dores, métricas, depoimentos, CTA, TypingEffect) 100% adaptada a cada segmento. A `LandingPage.tsx` original NÃO será alterada.

## Arquivos a criar

- `src/pages/LandingHamburgueria.tsx`
- `src/pages/LandingPizzaria.tsx`
- `src/pages/LandingBar.tsx`
- `src/pages/LandingSushi.tsx`
- `src/pages/LandingMarmitaria.tsx`
- `src/pages/LandingSorveteria.tsx`

Cada uma será praticamente uma cópia da `LandingPage.tsx` com as constantes locais (`painPoints`, `sellingModes`, `testimonials`, `heroBadge`, `heroMetrics`, `typingWords`, `ctaFinalTitle`, `content_name` do Pixel) substituídas pelos textos do nicho conforme a especificação fornecida.

## Arquivos a modificar

### `src/components/landing/TypingEffect.tsx`
Aceitar uma prop opcional `words?: string[]` (mantendo o array padrão atual como fallback) para que cada landing de nicho passe seu próprio array (ex.: `["sua hamburgueria", "seu delivery de burgers", "sua smash burger"]`) sem afetar a landing original.

### `src/App.tsx`
- Adicionar 6 imports lazy:
  ```tsx
  const LandingHamburgueria = lazyWithRetry(() => import("./pages/LandingHamburgueria"));
  // ... e os outros 5
  ```
- Adicionar 6 rotas **antes** das rotas dinâmicas `/:slug`:
  ```tsx
  <Route path="/hamburgueria" element={<LandingHamburgueria />} />
  <Route path="/pizzaria" element={<LandingPizzaria />} />
  <Route path="/bar" element={<LandingBar />} />
  <Route path="/sushi" element={<LandingSushi />} />
  <Route path="/marmitaria" element={<LandingMarmitaria />} />
  <Route path="/sorveteria" element={<LandingSorveteria />} />
  ```
  Posição: junto com `/v1`, `/v2`, `/v3` (já estão antes de `/` e `/:slug`).

## O que se mantém igual em todas

- Estrutura de seções: Header → Hero → Stats (4 cards) → Soluções → Dores → Painel Admin (com tabs) → Como Começar → Recursos → Depoimentos → Segmentos → Simulador → Pricing → FAQ → CTA Final → Footer.
- Componentes compartilhados: `ScrollReveal`, `TypingEffect`, `PhoneMockup`, `SavingsSimulator`.
- Planos e preços: Básico R$ 69,90 / Intermediário R$ 149,90 / Avançado R$ 249,90 — Avançado destacado como "Mais Escolhido".
- Navegação: `/registro/:planSlug` nos CTAs dos planos, `/registro/trial` no Hero/Simulador/CTA final.
- Logo, paleta (primary laranja), tokens do design system.
- `useEffect` de auto-redirect para painel logado (`getActiveAdminRedirectPath`).
- `SavingsSimulator` com `registerUrl="/registro/trial"`.
- Sem novos assets — reutiliza os imports já existentes (`menusLogo`, `landingPdv`, `landingDre`, `landingWhatsapp`, etc.).

## O que muda em cada landing (por nicho)

Para cada uma, são substituídos:
1. **Hero badge** (texto "Usado por mais de X...").
2. **TypingEffect words** (passados via prop).
3. **3 métricas inline** do hero.
4. **`painPoints`** (4 pares dor → solução, conforme a spec).
5. **`sellingModes`** quando o nicho exige adaptação (Hamburgueria troca os 4 modos; demais mantêm os genéricos ajustando descrições leves quando relevante).
6. **`testimonials`** (3 depoimentos do nicho).
7. **CTA final title** (ex.: "Pronto para vender mais burgers sem pagar comissão?").
8. **`trackEvent("ViewContent", { content_name: "Landing Hamburgueria", ... })`** — `content_name` específico por nicho.

Os textos exatos por nicho (badge, palavras do TypingEffect, métricas, 4 pares de dor/solução, 3 depoimentos, CTA final) seguem fielmente a especificação fornecida na mensagem.

## Detalhes técnicos

- Cada arquivo de landing é autocontido: importa os mesmos assets/ícones da original, declara as constantes locais com o conteúdo do nicho e renderiza a mesma árvore JSX.
- `TypingEffect` será atualizado para `({ words = defaultWords }: { words?: string[] })` — comportamento atual preservado quando chamado sem props (a `LandingPage.tsx` original continua funcionando sem mudança).
- Rotas adicionadas no bloco "Rotas estáticas globais" do `App.tsx`, garantindo que estejam **antes** de `/:slug` (que captura qualquer slug de restaurante).
- Sem novas dependências, sem mudanças em `tailwind.config.ts` ou `index.css`.

## Resultado

6 novas URLs públicas (`/hamburgueria`, `/pizzaria`, `/bar`, `/sushi`, `/marmitaria`, `/sorveteria`), cada uma com a mesma experiência visual da landing principal, mas com mensagem de marketing direcionada ao segmento — prontas para usar em campanhas pagas segmentadas por nicho.
