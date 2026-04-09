

## Plano: Fortalecer landing page com WhatsApp, screenshots reais, promessa forte e diferenciação

### Mudanças

**1. Adicionar seção WhatsApp entre Financeiro e Features Grid (nova seção)**
- Layout split-screen: texto à esquerda, imagem do WhatsApp (image-16.png) à direita
- Título: "Marketing automático e central de alertas no WhatsApp"
- Texto descritivo conforme solicitado
- 4 bullets: Remarketing automático, Cupons personalizados, Notificações de pedido, Segmentação inteligente
- Copiar image-16.png para `src/assets/landing-whatsapp.png`

**2. Substituir mockups por screenshots reais**
- Seção "Gestor de pedidos completo" (seção 3): trocar o mockup de cards de pedido pelo screenshot do PDV (image-17.png → `src/assets/landing-pdv.png`)
- Seção "Visão completa do seu negócio" (seção 4): trocar o DRE mockup pelo screenshot do Relatório DRE (image-18.png → `src/assets/landing-dre.png`)
- Ambas as imagens renderizadas como `<img>` com `rounded-2xl border shadow-xl`

**3. Fortalecer promessa no Hero**
- Subtítulo atual genérico → trocar para algo com promessa direta de resultado:
  - "Pare de perder pedidos. Aumente suas vendas sem pagar comissão. Automatize seu restaurante em minutos."

**4. Adicionar diferenciação clara**
- Após o hero badge "Usado por mais de 500 restaurantes", adicionar uma linha de diferenciadores compactos abaixo do subtítulo:
  - "✓ Zero comissão por pedido  ✓ Robô IA que vende 24h  ✓ DRE automático  ✓ Parceiro de integração iFood"

**5. Fortalecer prova social com números mais impactantes**
- Trocar textos dos depoimentos para incluir resultados mensuráveis (ex: "Triplicamos pedidos" → "Saí de 15 para 45 pedidos/dia no primeiro mês")
- Manter a seção de métricas (500+, 50k+, etc.)

**6. Menção discreta ao iFood**
- Na seção de segmentos ou no footer, adicionar um texto pequeno: "Parceiro de integração iFood" com ícone sutil
- Alternativa: incluir no badge de diferenciadores do hero

### Arquivos modificados
- `src/pages/LandingPage.tsx` — todas as mudanças acima
- `src/assets/landing-whatsapp.png` — copiado de upload
- `src/assets/landing-pdv.png` — copiado de upload
- `src/assets/landing-dre.png` — copiado de upload

