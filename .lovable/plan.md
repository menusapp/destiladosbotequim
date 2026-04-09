

## Plano: Reestruturar Landing Page

### Resumo
Três grupos de mudanças: (1) quebrar linha antes do TypingEffect no hero, (2) reformular seção de dor com formato dor→solução, (3) reorganizar ordem das seções e transformar "Funções" em carrossel horizontal dentro de "Tudo que seu restaurante precisa".

---

### 1. Hero — Quebra de linha antes da palavra animada

No `h1` (linha 120), adicionar `<br />` antes do `<TypingEffect />` para que a palavra animada fique sempre numa linha separada, evitando o "pulo" de layout:

```tsx
<h1 className="...">
  O sistema completo para
  <br />
  <TypingEffect />
</h1>
```

Também reservar altura mínima na linha do TypingEffect com um `<span className="inline-block min-h-[1.2em]">` para evitar colapso quando o texto está vazio.

---

### 2. Seção de Dor — Formato dor + solução

Reduzir de 6 itens para 3-4 dores reais de dono de restaurante, cada uma com a solução embaixo:

| Dor | Solução |
|-----|---------|
| "Você não sabe quanto realmente lucra no final do mês" | "DRE automático e fluxo de caixa em tempo real" |
| "Pedidos se perdem entre WhatsApp, telefone e balcão" | "Todos os pedidos centralizados num único painel" |
| "Comissões de apps de delivery corroem seu lucro" | "Delivery próprio com zero comissão por pedido" |
| "Falta de controle gera desperdício de estoque" | "Estoque com baixa automática e alertas" |

Layout: cards com ícone vermelho + texto da dor em cima, e solução com ícone verde + texto embaixo.

---

### 3. Reorganizar ordem das seções

Nova ordem após o Hero:

1. **Dor** (reformulada com dor+solução)
2. **Como começar** (3 passos) — mover para cima
3. **Gestor de pedidos completo** (Operação)
4. **Visão completa do seu negócio** (Financeiro)
5. **Tudo que seu restaurante precisa** (Vantagens) — absorve os itens de "Funções"
6. **Quem usa, recomenda** (Prova social)
7. **Versátil para diversos segmentos**
8. **Teste grátis por 7 dias** (Oferta)
9. **Escolha o plano ideal** (Pricing)
10. **Como começar** — removido daqui (já está acima)
11. **FAQ**
12. **CTA Final**

Remover a seção "Solução" standalone (linha 193-210) pois a seção de dor já mostra a solução.

---

### 4. "Tudo que seu restaurante precisa" — Carrossel horizontal

Mesclar os 12 itens de `features` (antiga seção "Funções") + os 8 itens de vantagens na seção "Tudo que seu restaurante precisa". Mostrar como carrossel horizontal scrollável com:

- Container com `overflow-x-auto` e `scroll-snap-x`
- Cards compactos (ícone + título + descrição curta) em fila horizontal
- Botões de seta esquerda/direita nos cantos
- Esconder scrollbar com CSS (`scrollbar-hide`)
- No mobile: scroll por toque natural

---

### Arquivos modificados
- `src/pages/LandingPage.tsx` — todas as mudanças acima

