# Refatoração do PDV Mobile — handheld operacional

## Contexto

`src/components/admin/PDVTab.tsx` tem **2150 linhas** com estado profundamente acoplado (carrinho, mesas, comandas, clientes, endereços, pagamento, fiscal, impressão, reservas, zonas de entrega). É o coração operacional do sistema — qualquer regressão quebra restaurantes em produção.

Por isso a refatoração será **faseada e isolada por componente**, mantendo `PDVTab.tsx` como orquestrador e extraindo a UI mobile para componentes novos. **Nenhuma regra de negócio, integração, RPC ou cálculo será alterado** — apenas camada de apresentação mobile.

## Estratégia geral

- Criar um **novo modo "handheld"** acionado quando `useIsMobile()` é true, sem tocar no layout desktop.
- Componentes novos vivem em `src/components/admin/pdv/mobile/` e consomem o estado/handlers já existentes do `PDVTab` via props.
- Cada fase entrega valor isolado e pode ser testada antes da próxima.
- Reutilizar tokens semânticos do design system (laranja primário, sem cores hardcoded).

## Fases (na ordem de prioridade que você pediu)

### Fase 1 — Estrutura mobile + Categorias horizontais fixas
- Novo `PDVMobileShell` que envolve apenas a renderização mobile.
- `PDVCategoryStrip`: tira horizontal sticky com chips de categoria, scroll-snap, indicador da categoria ativa, "Todos" + "⚡ Mais pedidos".
- Filtro de produtos passa a respeitar a categoria selecionada + busca (já normalizada via `normalizeSearch`).

### Fase 2 — Grid compacto de produtos
- `PDVProductGrid` mobile: 2 colunas, card compacto (imagem 64px, nome 2 linhas, preço, botão `+` 44×44 destacado em primary).
- Área de toque ≥44px, ripple/active state, sem cliques acidentais (botão `+` com `stopPropagation`).

### Fase 3 — Carrinho fixo inferior + bottom-sheet
- `PDVCartBar` fixo na base: "N itens • R$ XX,XX" + botão "Ver pedido", respeita safe-area.
- `PDVCartSheet` (bottom sheet via `Sheet side="bottom"`): lista itens, qtd ±, editar, remover, observações por item, total.
- Reaproveita os handlers atuais (`addToCart`, `removeFromCart`, `updateQuantity`).

### Fase 4 — Fluxo por etapas (tipo → produtos → carrinho → finalizar)
- `PDVOrderTypeStep`: tela inicial com 3 cartões grandes — Mesa / Delivery / Retirada.
- Após escolher tipo, vai direto pra grade de produtos.
- Campos de cliente / CPF / endereço / pagamento ficam em **seções colapsáveis** dentro do `PDVCartSheet` ("+ Cliente", "+ Dados fiscais", "+ Pagamento", "+ Endereço" quando delivery).
- CPF e observações iniciam recolhidos.

### Fase 5 — Busca turbinada
- Autofocus no input ao abrir a busca, `inputMode="search"`.
- Debounce já existe (`useDebounce`).
- Normalização de acentos já existe (`normalizeSearch`); adiciona tolerância a abreviação (substring por palavra).
- Ranking: produtos mais pedidos primeiro (usar `order_count` se disponível na query, senão fallback alfabético).
- Seção "⚡ Mais pedidos" no topo quando não há busca/categoria.

### Fase 6 — Touch & micro-UX
- Padronizar altura mínima 44px em todos os controles do PDV mobile.
- Aumentar `gap` entre botões críticos (confirmar/cancelar) pra evitar mistap.
- Feedback tátil via `active:scale-[0.97]` e transições rápidas (150ms).

### Fase 7 — Grid visual de mesas
- Substituir o `Select` de mesa (no fluxo Mesa) por um `PDVTableGrid`: chips/tiles de mesa coloridos por status (livre / ocupada / reservada), tap único pra selecionar.
- Reaproveita `tablesQuery` e `buildActiveReservationByTable` já existentes.

### Itens 11 e 12 (dark mode + identidade visual)
- Já usamos tokens semânticos via `index.css`; vou garantir que todos os componentes novos usem `bg-background`, `text-foreground`, `bg-primary`, etc., para que o dark mode "ligue" automaticamente quando o tema for ativado. **Não vou ativar dark mode agora.**

## Garantias de não-regressão

- Desktop intocado: gating por `useIsMobile()`.
- Nenhuma alteração em: queries Supabase, mutations, cálculo de total, fluxo de pagamento, impressão, NFCe, integrações iFood/DD, comandas, RPCs.
- Todos os componentes novos consomem props/handlers que já existem em `PDVTab`.
- `PDVProductDrawer` continua sendo o sheet de extras/adicionais (já é mobile-friendly).

## Detalhes técnicos

- Novos arquivos:
  - `src/components/admin/pdv/mobile/PDVMobileShell.tsx`
  - `src/components/admin/pdv/mobile/PDVOrderTypeStep.tsx`
  - `src/components/admin/pdv/mobile/PDVCategoryStrip.tsx`
  - `src/components/admin/pdv/mobile/PDVProductGrid.tsx`
  - `src/components/admin/pdv/mobile/PDVCartBar.tsx`
  - `src/components/admin/pdv/mobile/PDVCartSheet.tsx`
  - `src/components/admin/pdv/mobile/PDVTableGrid.tsx`
- `PDVTab.tsx` ganha um bloco `if (isMobile) return <PDVMobileShell {...props} />` no topo do return, mantendo o JSX desktop atual intacto abaixo.
- Tipos `CartItem`, `TableData`, `SelectedCustomer`, etc. movidos para `src/components/admin/pdv/types.ts` e re-exportados para evitar duplicação.

## Tamanho estimado

~7 componentes novos (+~1500 linhas) e ~50 linhas tocadas em `PDVTab.tsx`. Nenhum arquivo existente deletado.

## Confirmação

Antes de começar, confirma 2 pontos:

1. Posso entregar tudo numa única passada (todas as 7 fases) ou prefere que eu pare após a Fase 3 (categorias + grid compacto + carrinho fixo) pra você testar antes do resto?
2. O fluxo "Mesa → escolher mesa → produtos" deve abrir a comanda imediatamente ao tocar na mesa, ou só ao confirmar o pedido (como é hoje)?
