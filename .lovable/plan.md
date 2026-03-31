

# Plano — 3 Ajustes Rápidos

## 1. Remover emojis das notificações

**`NewOrderNotification.tsx`:**
- Trocar `🍽️ Mesa X` → `Mesa X`, `📦 Retirada` → `Retirada`, `🚚 Delivery` → `Delivery`
- Trocar o `🔔` do ícone circular por um ícone Lucide `Bell`

**Risco:** Zero.

## 2. Cascata real estilo iPhone (empilhamento visual)

Atualmente as notificações ficam em `flex-col gap-2` (uma embaixo da outra). O comportamento desejado tem **2 estados**:

**Estado colapsado (padrão):** pílulas empilhadas visualmente "atrás" da mais recente, com offset de ~8px cada, mostrando só a bordinha. A mais recente (índice 0) fica na frente. Máximo 3 visíveis + badge "+N".

**Estado expandido (ao clicar na pilha):** todas as notificações aparecem em lista vertical com scroll, cada uma como pílula fechada. Aí o operador pode abrir cada uma individualmente para ver detalhes e aceitar.

**Alterações em `RestaurantAdmin.tsx` (linhas 834-877):**
- Adicionar estado `cascadeExpanded` (boolean) para controlar pilha colapsada vs lista expandida
- Quando colapsado: renderizar com `position: absolute`, offset `top: index * 8px`, escala levemente menor nas de trás
- Quando expandido: renderizar como lista vertical com scroll (`max-h-[70vh] overflow-y-auto`)
- Clicar na pilha colapsada → expande. Botão "fechar" na lista → colapsa

**Alterações em `NewOrderNotification.tsx`:**
- Quando expandido individualmente, mostrar primeiros 3 itens do pedido (precisará receber `items` como prop opcional)
- Adicionar prop `items?: Array<{name: string; quantity: number}>` 

**Alterações em `RestaurantAdmin.tsx` (notificação queue):**
- Ao criar notificação, buscar os itens do pedido e incluir na fila

**Risco:** Baixo. Apenas visual, lógica de fila/aceitar/som intacta.

## 3. Sugestões "Que tal adicionar?" menores na sacola

**`ProductSuggestions.tsx`:**
- Reduzir de 6 para 3 produtos sugeridos
- Trocar grid `grid-cols-3` para layout horizontal scrollável em linha única
- Reduzir tamanho dos cards: imagem menor (48x48 em vez de aspect-square), texto compacto
- Remover o emoji `🍽️` do placeholder de imagem

**`CartStep.tsx` (checkout):**
- O componente já está inline no scroll, não precisa de mudança estrutural. A redução do `ProductSuggestions` já resolverá o problema de ter que rolar para ver o subtotal e botão Continuar.

**Risco:** Zero. Apenas visual.

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `NewOrderNotification.tsx` | Remover emojis, usar ícone Lucide, prop items, mostrar itens ao expandir |
| `RestaurantAdmin.tsx` (linhas 834-877) | Cascata colapsada/expandida, buscar items na notificação |
| `ProductSuggestions.tsx` | Cards menores, scroll horizontal, max 3 |

Nenhuma funcionalidade alterada. Apenas camada visual.

