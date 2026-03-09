

## Plano: Melhorar Landing Page

### Mudancas

**1. Remover "teste gratuito por 7 dias"**
- Linha 159: remover "Acesso gratis por 7 dias · Sem cartao de credito"
- Linha 114-115: mudar botao "Teste gratis" para "Comecar agora"
- Linha 151-153: mudar "Comecar gratuitamente" para "Comecar agora"
- Linha 483-485: ajustar CTA final

**2. Social Proof - numeros mais realistas e compreensiveis**
- Substituir os 4 items (linhas 359-371) por:
  - "500+" Restaurantes ativos
  - "50.000+" Pedidos por mes
  - "4.9/5" Avaliacao dos clientes
  - "0%" Taxa sobre vendas

**3. Planos - reordenar e renomear**
- Basico (R$99) fica na esquerda (mesmo lugar)
- Premium (ex-Completo, R$349) vai pro meio, marcado como "Mais Escolhido"
- Avancado (ex-Profissional, R$199) vai pra direita
- Atualizar nomes, descricoes e botoes

**4. Gerar imagens com AI para placeholders vazios**
- Hero mockup (linha 164-171): gerar imagem de dashboard/sistema
- WhatsApp section (linha 228-232): gerar imagem de celular com WhatsApp
- Gestor de pedidos (linha 289-291): gerar imagem de tela de pedidos
- Visao financeira (linha 321-323): gerar imagem de graficos financeiros
- Usar edge function com Lovable AI (gemini-3.1-flash-image-preview) para gerar as imagens e salvar no storage

**5. Tornar mais harmonico e menos "cru"**
- Adicionar gradientes sutis entre secoes
- Melhorar espacamento e transicoes visuais
- Adicionar decorative elements (circulos blur, linhas gradientes) em secoes-chave
- Melhorar o CTA final com mais destaque visual

### Arquivos
- **Editar:** `src/pages/LandingPage.tsx` (todas as mudancas acima)
- **Criar:** `supabase/functions/generate-landing-images/index.ts` (edge function para gerar imagens)

### Abordagem para imagens
Vou criar uma edge function que usa o modelo de geracao de imagens do Lovable AI para criar 4 imagens profissionais (dashboard, whatsapp, pedidos, financeiro), salvar no storage do Supabase, e referenciar as URLs na landing page. Enquanto as imagens nao carregam, mostra o placeholder atual.

