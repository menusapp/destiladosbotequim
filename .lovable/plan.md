

## Plano: Corrigir overflow do painel "Novo Pedido" no PDV

### Problema

O container pai `<main>` em `RestaurantAdmin.tsx` (linha 731) tem `overflow-auto p-4`, o que permite scroll da página inteira quando o conteúdo do painel direito excede a altura da viewport. O `h-full` do PDVTab não resolve porque o `main` cresce com o conteúdo.

### Correção (apenas `PDVTab.tsx`)

1. **Trocar `h-full` por altura calculada**: Mudar o wrapper principal de `h-full` para `h-[calc(100vh-7rem)]` (descontando header + padding do main). Isso força o PDVTab a caber na tela sem depender do parent.

2. **Garantir que o painel direito respeita o limite**: O painel direito (linha 692, `w-[420px]`) já tem `flex flex-col min-h-0` e o `ScrollArea` interno — basta que o container pai tenha altura fixa real (item 1 resolve isso).

### Arquivo

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | Linha 479: `h-full` → `h-[calc(100vh-7rem)]` para fixar altura real da tela |

