
## O que muda no PDV mobile

Tudo em `src/components/admin/PDVTab.tsx`. Desktop intocado.

### 1. Inverter a ordem das etapas

Nova ordem do wizard mobile:

```text
1. Dados do pedido   →  2. Produtos   →  3. Pagamento
```

- Trocar o tipo `mobileStep` para `"dados" | "produtos" | "pagamento"`.
- Estado inicial vira `"dados"` (atualizar os 3 pontos onde hoje é resetado para `"produtos"`: FAB, clique em mesa e abertura do painel).
- Atualizar a barra de progresso (linha ~1522) para iterar nessa nova ordem — assim os "passos concluídos" pintam corretamente.
- Atualizar os botões Voltar/Próximo do rodapé (linhas ~2197 e ~2237):
  - Voltar: `pagamento → produtos`, `produtos → dados`.
  - Próximo: `dados → produtos`, `produtos → pagamento`.
  - Em `pagamento` o botão final continua "Criar pedido".
- Validação leve no "Próximo" da etapa Dados quando for Mesa (exigir mesa selecionada) e Delivery (exigir endereço básico) — feedback via toast, sem travar o fluxo das outras etapas.

### 2. Header mobile mais baixo (mais espaço para o conteúdo)

Hoje o topo soma ~180px (handle + header + pills Mesa/Delivery/Retirada + barra de progresso + paddings). Vamos reduzir para ~96px:

- **Header título**: altura dos botões cai de `h-10` para `h-9`, título passa para `text-sm`, margem `mb-3 mt-3` → `mb-2 mt-2`.
- **Pills Mesa/Delivery/Retirada**: altura `h-9` → `h-8`, padding do wrapper `p-1` → `p-0.5`, `mb-3` → `mb-2`, texto `text-xs` mantém, ícone só (sem texto) opcional — manter texto curto.
- **Barra de progresso**: passa a ficar **na mesma linha** do título (3 traços finos `h-1` à direita do título) em vez de bloco separado. Remove uma linha inteira de altura.
- **Drag handle**: encolhe `h-1.5` → `h-1` e fica colado no topo (`top-1.5`).
- Padding do sheet inteiro: usar `pt-2 pb-2 px-3` no mobile em vez do `p-6` padrão do Sheet.

### 3. Layout travado, sem comer borda

- Sheet mobile passa a usar `flex flex-col h-[100dvh]` (ou `h-screen` com `max-h-[100dvh]`) com 3 zonas fixas:
  ```text
  ┌─────────────────────────────┐
  │ HEADER (fixo, ~96px)        │  shrink-0
  ├─────────────────────────────┤
  │ CONTEÚDO da etapa atual     │  flex-1 + overflow-y-auto
  │ (Dados / Produtos / Pgto)   │
  ├─────────────────────────────┤
  │ FOOTER ações (fixo, ~64px)  │  shrink-0 + safe-area
  └─────────────────────────────┘
  ```
- Trocar o `ScrollArea` atual por um `<div className="flex-1 overflow-y-auto overscroll-contain px-1">` para o radix scroll-area parar de cortar conteúdo nas bordas.
- Aplicar `pb-[env(safe-area-inset-bottom)]` no footer e `px-3` consistente no conteúdo (hoje varia entre `pr-3` e `p-4`, causando o "comendo borda").
- Cards de seção (Cliente, Endereço, Mesa, Observação, Pagamento) no mobile: trocar `p-4` por `p-3` e `rounded-lg` mantém — ganha respiro lateral.
- Grid de produtos (Etapa 2) mantém o card horizontal já existente — só herda o espaço extra liberado pelo header menor.

### 4. Detalhes finos

- Título dinâmico do header passa a refletir a nova ordem (já é derivado de `mobileStep`, só revisar wording).
- Manter cor/estilo dos botões "Próximo" e "Criar pedido" como estão (primary).
- Sem mudanças em lógica de negócio, validações de pagamento, impressão, criação de pedido ou desktop.

### Arquivo afetado

```text
src/components/admin/PDVTab.tsx
```

Nenhum componente novo, nenhuma mudança de backend.
