

## Plano: Redesign da Landing Page no estilo cardapio.ai

A landing page atual sera completamente reescrita para seguir a estrutura e estilo do cardapio.ai, adaptada com as cores do Menu's (laranja #FF6B00) e com MUITO mais conteudo.

### Estrutura das Secoes (inspirada no cardapio.ai)

1. **Header** -- Sticky, clean, com nav links + dropdown "Acesso" com opcoes (Entrar no Painel, Entrar como Staff) + botao CTA "Teste gratis"

2. **Hero** -- Imagem/mockup grande no topo (placeholder com gradiente simulando devices), badge social proof ("Sistema usado por mais de 500 restaurantes"), headline com efeito de typing animado ("para restaurantes | hamburguerias | pizzarias | bares"), subtitulo, CTA grande, texto "Acesso gratis por 7 dias"

3. **Carousel de Funcoes** -- Cards horizontais com scroll (estilo cardapio.ai "Funcoes para voce vender"), cada card com icone/ilustracao, titulo e descricao curta:
   - Venda sem taxas (delivery, retirada, balcao, mesa)
   - Facil e personalizado
   - Robo de pedidos WhatsApp
   - Impressao automatica
   - Gestao de estoque e CMV
   - Areas de entrega
   - Suporte dedicado

4. **Secao WhatsApp/Automacao** -- Bloco grande com titulo "Marketing automatico e central de alertas no WhatsApp", descricao, highlights com icones

5. **Grid de Features visuais** (estilo bento grid do cardapio.ai) -- Cards de tamanhos variados mostrando:
   - Cardapio personalizado com sua marca
   - Programa de fidelidade e CRM
   - Pagamento online (Pix, cartao)
   - Complementos e adicionais
   - Controle de estoque automatico
   - Relatorios, DRE e fluxo de caixa
   - Nota fiscal eletronica
   - Reservas de mesas

6. **Secao "Versatil para diversos segmentos"** -- Grid com cards: Restaurante, Hamburgueria, Pizzaria, Bar, Cafeteria, "E muito mais!"

7. **Planos e Precos** -- 3 cards (Basico R$99, Profissional R$199, Completo R$349) com destaque no do meio, lista de features, botao CTA, badge "valor por dia"

8. **Secao "Gestor de pedidos"** -- PDV, app garcom, comandas, confirmacao automatica

9. **Secao "Visao de negocios"** -- Faturamento, relatorios, DRE, CMV, fluxo de caixa

10. **Numeros/Social Proof** -- +500 restaurantes, +1M pedidos, +R$X economizados

11. **Secao "Como comecar?"** -- 3 passos: Crie sua conta, Configure seu cardapio, Comece a vender

12. **FAQ** -- Accordion expandivel com 8+ perguntas

13. **CTA Final** -- Secao de chamada com fundo gradiente

14. **Footer** -- Links, copyright

### Design e Animacoes

- **Typing effect** no hero (rotaciona palavras: "restaurantes", "hamburguerias", "pizzarias", "bares", "cafeterias")
- **Scroll reveal** em todas as secoes (Intersection Observer, fade-in + translate-y)
- **Carousel horizontal** com scroll snap para cards de funcionalidades
- **Hover effects** nos cards (scale, shadow, border color transition)
- **Counter animation** nos numeros de social proof (contagem animada de 0 ate o valor)
- **Bento grid layout** para features visuais (cards de tamanhos diferentes, 2-3 colunas)
- Background branco limpo (#FFFFFF) nas secoes principais, cinza claro (#F7F7F8) alternando
- Tipografia grande e bold no hero, espacamento generoso

### Arquivos

- **Reescrever:** `src/pages/LandingPage.tsx` -- landing completa (~600-800 linhas)

Nenhuma outra pagina sera alterada. Apenas a landing page.

