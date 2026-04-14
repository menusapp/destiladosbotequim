

## Plano: Melhorar Espaçamento da Impressão Térmica

### Problema
O recibo está saindo compactado demais — pouca margem no topo/rodapé e informações muito juntas entre si.

### Mudanças no CSS (`printOrder.ts`)

Todas as alterações são apenas nos valores de espaçamento do CSS inline:

| Elemento | Atual | Novo | O que muda |
|----------|-------|------|------------|
| `body padding` | 6px | 12px | Margem geral maior nas laterais |
| `body padding-top` | — | 16px | Margem maior no topo |
| `body padding-bottom` | — | 20px | Margem maior no final |
| `.line` margin | 6px 0 | 10px 0 | Linhas tracejadas mais espaçadas |
| `.double-line` margin | 6px 0 | 12px 0 | Linhas duplas mais espaçadas |
| `h1` margin | 2px 0 | 6px 0 | Nome do restaurante mais respirado |
| `.origin` margin | 6px 0 | 10px 0 | Tipo do pedido mais destacado |
| `.origin` padding | 4px | 6px 4px | Mais respiro interno |
| `.item` margin | 4px 0 | 8px 0 | Itens separados entre si |
| `.section` margin | 4px 0 | 8px 0 | Seções de info mais espaçadas |
| `.section p` margin | 2px 0 | 4px 0 | Linhas de texto dentro de seções |
| `.total-row` margin | 4px 0 | 8px 0 | Total mais destacado |
| `.footer` margin-top | 8px | 16px | Rodapé mais separado |
| `body line-height` | 1.4 | 1.5 | Entrelinhas levemente maior |

### Layout visual do recibo (aproximado)

```text
┌──────────────────────────┐
│                          │  ← margem topo 16px
│    NOME DO RESTAURANTE   │
│                          │
│ - - - - - - - - - - - -  │  ← margin 10px
│                          │
│ ┌──────────────────────┐ │
│ │ PEDIDO LOCAL - MESA 5│ │  ← padding 6px, margin 10px
│ └──────────────────────┘ │
│                          │
│  Pedido: #abc12345       │
│  Data: 14/04/2026 18:30  │  ← margin entre linhas 4px
│  Cliente: João Silva     │
│                          │
│ ════════════════════════ │  ← margin 12px
│                          │
│  2x X-Bacon      R$40,00│
│    + Cheddar      R$ 3,00│  ← margin entre itens 8px
│                          │
│  1x Coca-Cola     R$8,00 │
│                          │
│ ════════════════════════ │  ← margin 12px
│                          │
│  TOTAL         R$ 51,00  │  ← margin 8px
│                          │
│ - - - - - - - - - - - -  │
│                          │
│  Impresso em 14/04 18:32 │  ← margin-top 16px
│                          │  ← margem final 20px
└──────────────────────────┘
```

### Arquivo editado
- `src/lib/printOrder.ts` — apenas valores CSS, sem mudança de lógica

