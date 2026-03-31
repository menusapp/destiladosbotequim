

# Plano — 2 Ajustes (Fidelidade + Tempo de Preparo)

## Ajuste 1 — Fidelidade visível imediatamente ao abrir sacola

**Problema:** O `LoyaltyRewardNotification` no `CartStep.tsx` faz queries assíncronas ao montar, causando delay visual. Ele fica após `ProductSuggestions` e `CouponInput`, que também fazem queries.

**Solução:** Mover o bloco de `LoyaltyPointsDisplay` e `LoyaltyRewardNotification` para **antes** das sugestões de produtos no `CartStep.tsx`. Ordem nova:
1. Itens adicionados
2. Loyalty Points Display (se `loyalty_enabled`)
3. Loyalty Reward Notification (se `customerCPF`)
4. Active Reward Discount
5. Product Suggestions
6. Coupon Input
7. Summary + Botão Continuar

**Arquivo:** `src/components/menu/checkout/CartStep.tsx` — reordenar JSX (linhas 253-321)

**Risco:** Zero. Apenas reordena componentes visuais.

---

## Ajuste 2 — Tempo de preparo por produto (não geral)

**Problema atual:** A Comanda usa `prep_time_minutes` geral do restaurante para mostrar um timer único. O usuário quer:
- Remover o timer geral da Comanda e do RestaurantInfoCard (mesas)
- Remover o campo "Minutos estimados" das configurações operacionais
- Manter apenas o toggle ativar/desativar no card de "Tempo de Preparo" nas configurações
- Se ativado, mostrar o `prep_time_minutes` de **cada produto** ao lado de cada item pedido na Comanda
- Timer por item: conta regressiva desde o `created_at` do pedido, não reinicia ao navegar

### Alterações:

**`CompanyDataSettings.tsx`:**
- Remover o card separado "Tempo de Preparo" com campo de minutos (linhas 311-334)
- No card "Contador de Tempo nos Pedidos" (linhas 336-375), manter apenas o toggle e o botão zerar — agora será o único card de tempo

**`RestaurantInfoCard.tsx`:**
- Quando `tableInfo` está presente, **não mostrar** a linha "Tempo estimado: X-Y min" (linhas 132-137)

**`Menu.tsx`:**
- Remover o cálculo de `deliveryTime` baseado em `prep_time_minutes` para mesas (linha 1021)
- Não passar `deliveryTime` ao `RestaurantInfoCard` quando for mesa

**`Comanda.tsx`:**
- Buscar `show_prep_timer` do restaurante
- Buscar `prep_time_minutes` de cada produto nos `order_items` (join com `products`)
- Remover o timer geral (o card grande com contagem regressiva geral, linhas 898-922)
- Em cada item pedido, se `show_prep_timer === true`, mostrar um badge pequeno com contagem regressiva baseada em: `max(0, product.prep_time_minutes * 60 - elapsed_seconds_since_order_created_at)`
- O `created_at` do pedido (order) é a referência — não resetar ao navegar
- Quando o timer de um item chega a 0, mostrar "Pronto"

**`Comanda.tsx` — tipo `OrderItem` e `Order`:**
- Adicionar `prep_time_minutes` ao tipo `products` no OrderItem
- Na query de orders, incluir `products(name, prep_time_minutes)` em vez de apenas `products(name)`

**Risco:** Baixo. Remove funcionalidade de timer geral e substitui por timer por produto. Nenhum fluxo de pedido/pagamento alterado.

---

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `CartStep.tsx` | Reordenar: fidelidade antes das sugestões |
| `CompanyDataSettings.tsx` | Unificar cards de tempo, remover campo minutos |
| `RestaurantInfoCard.tsx` | Remover "Tempo estimado" para mesas |
| `Menu.tsx` | Não passar deliveryTime para mesas |
| `Comanda.tsx` | Timer por produto, buscar show_prep_timer, remover timer geral |

