

## Plano: Eliminar rolagem de página nos cardápios — layout fixo com scroll interno

### Problema identificado

Várias páginas do cardápio usam `min-h-screen` e empilham conteúdo verticalmente, empurrando botões de ação (como "Fazer Novo Pedido", "Pedir a Conta", "Enviar Pedido") para fora da viewport. O usuário precisa rolar a página inteira para encontrar esses botões.

### Páginas afetadas e correções

#### 1. `OrderConfirmation.tsx` — Botão "Fazer Novo Pedido" escondido

**Problema**: Status, timeline, detalhes do pedido, endereço e tempo estimado empilhados. O botão "Fazer Novo Pedido" fica na última posição.

**Correção**:
- Container principal: `h-screen flex flex-col overflow-hidden`
- Conteúdo central (cards): `flex-1 overflow-y-auto` com scroll interno
- Botão "Fazer Novo Pedido": fixo no rodapé, fora do scroll (`shrink-0 p-4`)
- Remover `mb-6` dos cards finais e usar `pb-4` no scroll area

#### 2. `Comanda.tsx` — Botões "Enviar Pedido" e "Pedir a Conta" escondidos

**Problema**: Header + status + carrinho + pedidos + resumo + botão pedir conta — tudo empilhado. Com muitos itens, o botão de ação fica muito abaixo.

**Correção**:
- Container principal: `h-screen flex flex-col overflow-hidden` (em vez de `min-h-screen`)
- Header colorido: `shrink-0`
- Área de conteúdo (`.container`): `flex-1 overflow-y-auto min-h-0`
- Rodapé sticky com os botões de ação ("Enviar Pedido" ou "Pedir a Conta"): `shrink-0` fixo no fundo, sempre visível
- Os botões são extraídos dos cards e colocados como barra fixa inferior

#### 3. `Menu.tsx` e `DeliveryMenu.tsx` — Cardápios de navegação

Estes são cardápios de browsing onde rolar categorias é esperado. A `ComandaBottomBar` e `CartBottomBar` já são fixas no fundo. O problema aqui é menor, mas vou garantir que:
- `Menu.tsx`: Manter `pb-32` para não esconder conteúdo atrás da barra
- `DeliveryMenu.tsx`: Manter `pb-14` para a bottom nav

Estes dois **não precisam de mudança estrutural** — o scroll de categorias é o comportamento correto para cardápios.

### Resumo de mudanças

| Arquivo | Mudança |
|---|---|
| `OrderConfirmation.tsx` | Layout `h-screen flex flex-col`, conteúdo com scroll interno, botão "Fazer Novo Pedido" fixo no rodapé |
| `Comanda.tsx` | Layout `h-screen flex flex-col`, conteúdo com scroll interno, barra de ação fixa no rodapé com "Enviar Pedido" ou "Pedir a Conta" |

