

## Plano: Ajustes de layout e funcionalidades do PDV

### 1. Sem rolagem da página — tudo cabe na tela

**Problema**: A página tem `overflow-y-auto` no lado esquerdo, causando scroll da página inteira.

**Correção**: Fazer o container principal usar `h-[calc(100vh-...)]` ou `overflow-hidden` no nível da página, e mover toda rolagem para dentro de áreas internas (grid de mesas com `overflow-y-auto` e painel direito já usa `ScrollArea`). O wrapper de mesas vai ganhar `overflow-y-auto` delimitado, sem afetar a página.

### 2. Botão "Gerenciar Mesas" no canto superior esquerdo, acima das mesas

**Correção**: Mover o botão de "Gerenciar Mesas" do header geral para logo acima do grid de mesas, alinhado à esquerda. O header mantém só o título e stats.

### 3. Resultados do search bar com rolagem interna (max-height)

**Problema**: Resultados de busca esticam a tela quando há muitos pedidos.

**Correção**: Envolver os resultados num container com `max-h-[300px] overflow-y-auto` para scroll interno.

### 4. Horário de ocupação da mesa nos pedidos

**Correção**:
- Usar `tables.occupied_at` (já existe no schema) como hora de entrada
- Quando a mesa é liberada, o `occupied_at` volta a `null` — então não dá para mostrar horário de saída em mesas ativas, mas sim nas que já foram finalizadas
- Nos cards de mesa ocupada: mostrar "Desde HH:mm" usando `occupied_at`
- Na busca de pedidos, incluir `created_at` do pedido para referência de horário
- Para histórico completo (entrada/saída), a informação de saída estaria na `bill.paid_at` ou `comanda.closed_at`

### 5. Filtro de data no search bar

**Correção**:
- Adicionar um `DatePicker` (Popover + Calendar) no final da barra de busca
- State `orderSearchDate` (Date | undefined)
- Quando selecionada uma data, filtrar `searchableOrders` por `created_at` naquele dia
- A query de searchable orders passa a não filtrar só ativos — quando há data selecionada, busca todos os pedidos locais daquele dia (incluindo `delivered`, `cancelled`, `paid`)
- Isso permite pesquisar pedidos passados por dia

### Arquivo

| Arquivo | Mudança |
|---|---|
| `PDVTab.tsx` | Layout `overflow-hidden` na página, scroll interno nas mesas e resultados; botão Gerenciar Mesas reposicionado; DatePicker com filtro de data; horário de ocupação nos cards |

