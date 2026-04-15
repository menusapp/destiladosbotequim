

## Plano: Matching de Produtos iFood por PDV Code + Taxa de Entrega por Origem

### Problema Atual
1. **Itens do iFood chegam como observação** — o `ifood-polling` salva todos os itens com `product_id: null` e coloca nome + complementos no campo `notes`. Não tenta vincular ao produto real do sistema pelo código PDV.
2. **Taxa de entrega** — não identifica a origem (iFood vs Delivery Direto vs sistema).

### O que será feito

**1. Adicionar matching de produtos no `ifood-polling`** (mesma lógica já funcional no `dd-polling`):
- Antes de processar itens, carregar todos os produtos do restaurante (via categories) com `pdv_code`, e todos os `extra_category_items` com `pdv_code`
- Para cada item do iFood, tentar vincular pelo `externalCode` do iFood → `pdv_code` do produto
- Fallback: tentar match por nome normalizado (uppercase, trim, sem espaços duplos)
- Para cada option/customization do item iFood, tentar vincular pelo `externalCode` → `pdv_code` do extra_category_item
- Inserir `order_item_extras` para complementos vinculados (como já faz o DD polling)
- Manter o `notes` apenas para observações reais, não para nomes de produtos

**2. Identificar origem da taxa de entrega**:
- Adicionar no campo `notes` do pedido a indicação da origem da taxa (ex: "Taxa de entrega: iFood" ou "Taxa de entrega: Delivery Direto")
- Usar a taxa de entrega real que vem do iFood/DD, não a do sistema

### Arquivos alterados
- `supabase/functions/ifood-polling/index.ts` — reescrever a seção de processamento de itens com lógica de matching

### Detalhes técnicos
- iFood API expõe `externalCode` nos items e options — esse é o campo que o restaurante configura no portal iFood com o código PDV
- A lógica de normalização: `str.trim().toUpperCase().replace(/\s+/g, " ")`
- Matching: `externalCode` → `pdv_code` (prioridade), depois nome normalizado (fallback)
- Complementos iFood ficam em `item.options[]` e `item.options[].customization[]`, cada um pode ter `externalCode`
- Os extras do sistema estão em `extra_category_items` (não `product_extras`)

