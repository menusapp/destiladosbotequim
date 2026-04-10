
Resumo

- Achei a causa: hoje o filtro compartilhado só cobre `product_ingredients` (insumo fixo do produto) e `extra_category_item_ingredients` (itens de categoria de complemento).
- As variações e complementos avulsos do produto são carregados via `product_extras` + `product_extra_ingredients`, então itens com ACEM por esse caminho continuam aparecendo.
- Não precisa mexer em backend nem migration. O ajuste pode ser 100% no front.

Plano

1. Corrigir a lógica compartilhada de indisponibilidade
- Editar `src/hooks/useInactiveStockItems.ts`.
- Manter os sets atuais e adicionar mais 2 saídas:
  - `disabledProductExtraIds`: extras/variações do produto ligados a insumos inativos.
  - `hiddenProductIdsByRequiredChoices`: produtos que perderam todas as opções válidas de escolha obrigatória.
- Regra de negócio:
  - produto com insumo fixo inativo: some.
  - variação com ACEM inativo: some.
  - complemento avulso com ACEM inativo: some.
  - item de categoria de complemento com ACEM inativo: some.
  - se todas as variações obrigatórias sumirem, o produto inteiro some.
  - se ainda sobrar pelo menos 1 variação válida, o produto continua com apenas as opções restantes.

2. Aplicar o filtro nos 3 fronts
- `src/pages/Menu.tsx`
- `src/pages/DeliveryMenu.tsx`
- `src/pages/Kiosk.tsx`
- Ajustes:
  - filtrar listas de produtos por `disabledProductIds` + `hiddenProductIdsByRequiredChoices`.
  - filtrar extras diretos por `disabledProductExtraIds`.
  - continuar filtrando itens de categorias de complemento por `disabledExtraCategoryItemIds`.
  - ao abrir um produto, recalcular as opções válidas antes de exibir o drawer/tela.

3. Blindagem para não quebrar fluxo
- Se um produto ainda aparecer por cache/lista antiga, mas ao abrir ficar sem nenhuma escolha obrigatória válida, bloquear a abertura e tratar como indisponível.
- Não alterar carrinho, pedidos, checkout, relatórios, fiscal, integrações nem cálculos financeiros.
- Manter a lógica centralizada no hook para Mesa, Delivery e Totem ficarem idênticos.

Detalhes técnicos
- Neste projeto, “variações” de insumo variável estão sendo salvas como `product_extras` com `is_required = true`.
- Então o ponto que falta hoje é ler `product_extra_ingredients` e cruzar isso com os insumos inativos.
- Alguns adicionais estão em `product_extras`; outros em `extra_category_items`. Vou cobrir os dois caminhos.

Validação após implementar
- Produto com insumo fixo inativo some do cardápio.
- Variações com ACEM somem individualmente.
- Se sobrar 1 variação válida, o produto continua.
- Se todas as variações obrigatórias sumirem, o produto some.
- Adicional/complemento com ACEM some.
- Mesmo comportamento em Mesa, Delivery e Totem.

Arquivos
- `src/hooks/useInactiveStockItems.ts`
- `src/pages/Menu.tsx`
- `src/pages/DeliveryMenu.tsx`
- `src/pages/Kiosk.tsx`
