

# Campo de Desconto no PDV

## Resumo
Adicionar seção de desconto colapsável na PDVTab, acima do carrinho, com suporte a porcentagem/valor fixo, aplicação no total ou por produto, e campo de motivo. Usar a coluna `coupon_discount` existente (mesmo padrão do CreateOrderDrawer) para persistir o desconto.

## Por que NÃO criar migration

A tabela `orders` já possui `coupon_discount` (numeric, nullable) que é usada pelo `CreateOrderDrawer` para descontos manuais. Adicionar colunas extras (`manual_discount_type`, `manual_discount_target`, `manual_discount_notes`) seria redundante neste momento — o valor absoluto do desconto já é persistido e reconhecido por todos os relatórios (DRE, Overview, Caixa). O campo `notes` do pedido pode conter o motivo do desconto.

## Detalhes Técnicos

### 1. Novos estados em `PDVTab.tsx`

```
discountExpanded: boolean (default false)
discountType: 'percentage' | 'value' (default 'value')
discountTarget: 'total' | productId (default 'total')
discountValue: string (input text)
discountNotes: string
```

`calculatedDiscount` como `useMemo`: se type=percentage e target=total, aplica % sobre subtotal; se target=productId, aplica % sobre (price+extras)*qty do item. Clamp para não exceder o valor alvo. Se type=value, usa o valor direto (clamped).

### 2. UI — Seção de desconto

Posicionar entre a seção de Pagamento e o Carrinho Summary. Visível apenas quando `cart.length > 0`.

- Header colapsável: "Desconto" + chevron
- Toggle % / R$ (dois botões)
- Select: "Total do pedido" + cada item do carrinho
- Input numérico com valor
- Input texto para motivo (opcional)
- Preview: "- R$ X.XX" em verde

### 3. Ajuste no `handleSubmit`

Passar `coupon_discount: calculatedDiscount > 0 ? calculatedDiscount : null` em todos os inserts de pedido (delivery, retirada, viagem, mesa). Mesmo padrão do CreateOrderDrawer.

### 4. Ajuste no Cart Summary e Footer

Exibir linha de desconto entre Subtotal e Total quando desconto > 0. Footer mostra total final (subtotal - desconto).

### 5. Limpar no `clearForm`

Resetar todos os estados de desconto.

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/PDVTab.tsx` | Adicionar estados, UI de desconto, ajustar handleSubmit e cart summary |

## O que NÃO muda
- Sem migration — usa `coupon_discount` existente
- Relatórios DRE, Overview, Caixa — já reconhecem `coupon_discount`
- CreateOrderDrawer — não afetado
- Backend / RPCs / triggers

