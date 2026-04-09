

## Plano: Limpar duplicações e simplificar a Landing Page

### Problema
A página tem conteúdo duplicado em várias seções e a área de features usa carrossel quando deveria mostrar tudo de uma vez em grid compacto.

---

### 1. Remover duplicações no array `allFeatures`

Reduzir de 20 itens para ~12, eliminando repetições:
- **Remover**: "Sem comissão" (já tem "Delivery sem comissão"), "Delivery próprio" (idem), "IA integrada" (já tem "Robô IA Vendedor"), "Mais pedidos", "Mais rápido", "Mais lucro", "Organização" (são vagos e não agregam)
- **Manter**: Cardápio, Delivery sem comissão, PDV, Robô IA, Estoque, Relatórios/DRE, NFC-e, Fidelidade/CRM, Marketing WhatsApp, Pagamento online, Impressão, Reservas

### 2. Trocar carrossel por grid compacto

Substituir o scroll horizontal (seção 5) por um grid responsivo com cards pequenos:
- Mobile: 2 colunas
- Tablet: 3 colunas
- Desktop: 4 colunas
- Cards menores: ícone + título + descrição de 1 linha
- Remover toda a lógica de scroll (ref, arrows, scrollCarousel function)

### 3. Fundir "Oferta/Teste grátis" (seção 8) com "CTA Final" (seção 11)

Ambas dizem "começar grátis / 7 dias / sem cartão". Remover a seção 11 (CTA Final) e manter apenas a seção 8 (Oferta) que é mais impactante com fundo laranja.

### 4. Reduzir FAQs

De 9 para 6 perguntas, removendo as mais óbvias ou redundantes:
- Remover: "Preciso de equipamentos especiais?" (similar a "Preciso instalar app?"), "O sistema funciona offline?" (pouco relevante), "Quanto tempo leva para configurar?" (já dito no hero)

---

### Resultado esperado
- ~20% menos conteúdo vertical
- Zero duplicação de mensagem
- Features visíveis de uma vez sem scroll
- Página mais limpa e objetiva

### Arquivo modificado
- `src/pages/LandingPage.tsx`

