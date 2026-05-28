# Redesign PDV Mobile — Velocidade do Garçom

Foco: **menos toques, mais legibilidade, gestos modernos**. Mantemos as tabs no topo (Mesas / Delivery / Balcão / Pedidos) e refazemos toda a experiência dentro de cada uma para mobile. Desktop fica intocado.

## Princípios (estilo Anota Aí / Goomer 2026)

- **Alvos de toque ≥ 56px**, tipografia 16-18px nos dados críticos (valor, mesa, item).
- **1 ação primária por tela**, sempre na faixa do polegar (bottom).
- **Bottom sheets** em vez de modais empilhados — fecham com swipe.
- **Feedback háptico/visual** em cada toque (scale + cor).
- **Estado da mesa visível em 1 olhada**: cor + tempo + valor.

---

## 1. Lista de Mesas (mobile)

**Hoje:** grid 2 colunas de cards densos, status pequeno, sem valor visível.

**Novo:**
- Grid 2 colunas, cards de **altura 120px** com:
  - Número da mesa gigante (32px, bold).
  - **Bolinha de status colorida** (verde livre, laranja ocupada <30min, vermelho >30min, azul aguardando pagamento).
  - **Valor aberto** em destaque (R$ XX,XX) quando ocupada.
  - **Tempo desde a abertura** (ex: "23 min") em chip.
  - Nº de comandas como badge no canto.
- **Filtros rápidos** em chips horizontais no topo: Todas / Ocupadas / Livres / Aguardando pagto.
- **Busca por número de mesa** com teclado numérico ao tocar no ícone de lupa.
- **Tap simples** = abre a comanda da mesa direto (hoje é duplo clique, confuso no mobile). Long-press = menu de ações (ocultar, transferir).
- **FAB "Novo pedido balcão"** flutuante (já existe, melhorar visual).

## 2. Adicionar Produtos (bottom sheet do pedido)

**Hoje:** bottom sheet 90vh, busca no topo, categorias em chips, grid 2 colunas de cards pequenos.

**Novo:**
- **Header pegajoso** com: nome da mesa/cliente + valor total atual + botão fechar.
- **Busca sempre visível** no topo com placeholder "Buscar produto ou código".
- **Chips de categoria** horizontais com scroll-snap, categoria ativa com fundo primary.
- **Cards de produto otimizados pra toque**:
  - Layout horizontal (imagem 64px à esquerda, nome + preço + botão "+" grande à direita).
  - Botão **"+" de 48px** já adiciona 1 unidade direto (sem abrir drawer) se o produto **não tem adicionais obrigatórios**.
  - Se tem adicionais → abre drawer de adicionais.
  - Quantidade já no carrinho aparece como badge sobreposta no card.
- **Atalho de últimos vendidos**: chip "🔥 Mais vendidos hoje" no início das categorias.
- **Recolher catálogo**: ao tocar no carrinho na barra inferior, catálogo recolhe e mostra revisão do pedido.

## 3. Carrinho / Revisão do Pedido

**Hoje:** lista vertical simples no mesmo bottom sheet.

**Novo:**
- **Barra inferior persistente** dentro do sheet: `[🛒 3 itens]  R$ 47,90  [Revisar →]`.
- Tela de revisão:
  - Cada item em card com:
    - Nome + adicionais em texto menor abaixo.
    - **Stepper grande** (− qty +) com 44px de toque.
    - Swipe horizontal para a esquerda → revela botão **Remover** (vermelho).
    - Tap no card → editar adicionais/observação.
  - Campo de **observação geral** colapsável.
  - Resumo: Subtotal / Taxa / Total em fonte grande.
- **CTA único bottom**: `Enviar para cozinha` (verde, 56px, full-width, sticky).

## 4. Fechamento / Pagamento

**Hoje:** fluxo desktop adaptado, várias seleções pequenas.

**Novo bottom sheet de pagamento:**
- **Total a pagar** em destaque (40px, centralizado).
- **Grid 2×3 de formas de pagamento** com ícone + nome (cards de 80px):
  - Dinheiro 💵 / Pix 📱 / Crédito 💳 / Débito 💳 / Voucher 🎟️ / Outro
- Ao escolher **Dinheiro**:
  - Teclado numérico grande customizado (estilo iFood) aparece in-line.
  - Atalhos de cédula: `[R$ 50] [R$ 100] [R$ 200] [Valor exato]`.
  - **Troco calculado em tempo real** abaixo (já existe, deixar 28px, verde).
- **Dividir conta**: botão "Dividir" no header — abre fluxo de split por pessoa ou por valor (já existe, manter, só polir).
- **CTA bottom**: `Confirmar pagamento` (56px, sticky).
- Após confirmação → **tela de sucesso** com ✓ animado + opções `[Imprimir] [Nova venda] [Voltar]`.

## 5. Microinterações e padrões transversais

- **Loading states** com skeleton (não spinner) nos cards de mesa e produtos.
- **Toasts** trocados por **snackbars bottom** com 1 ação (Desfazer remover item, por ex.).
- **Pull-to-refresh** na lista de mesas.
- **Vibração curta** (navigator.vibrate(10)) ao adicionar item / confirmar pagamento.
- **Safe area** respeitada (env(safe-area-inset-bottom)) para botões sticky em iPhone com notch.
- **Tab bar** do topo: aumentar altura para 52px, ícone + label, indicador animado por baixo.

---

## Arquivos afetados (frontend apenas)

```text
src/components/admin/PDVTab.tsx                 // grid de mesas + tab shell mobile
src/components/admin/PDVProductDrawer.tsx       // drawer de adicionais (polir)
src/components/admin/CreateOrderDrawer.tsx      // bottom sheet do pedido novo
src/components/admin/AddItemsToOrderDrawer.tsx  // bottom sheet adicionar itens à comanda
src/components/admin/TableDetailView.tsx        // revisão/pagamento da mesa (versão mobile)
```

**Novos componentes pequenos** (extraídos para manter PDVTab enxuto):
```text
src/components/admin/pdv/mobile/TableCardMobile.tsx
src/components/admin/pdv/mobile/TableFilterChips.tsx
src/components/admin/pdv/mobile/ProductRowMobile.tsx
src/components/admin/pdv/mobile/CartReviewSheet.tsx
src/components/admin/pdv/mobile/PaymentSheet.tsx
src/components/admin/pdv/mobile/CashKeypad.tsx
```

Tudo controlado via `useIsMobile()` — desktop continua exatamente como está.

## O que **não** muda

- Lógica de negócio (pedidos, pagamento, impressão, estoque, comandas).
- Tabs no topo (Mesas / Delivery / Balcão / Pedidos) — só ganha polimento visual.
- Auto-print, QZ Tray, integrações.

## Fora de escopo (perguntar depois se quiser)

- Modo offline / fila de sincronização.
- Tema escuro dedicado pro mobile.
- Atalhos por gesto entre abas (swipe lateral).
