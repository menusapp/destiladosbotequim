
Diagnóstico
- Os logs atuais não mostram erro de JavaScript dos complementos; só aviso de websocket do Vite, sem relação com esse bug.
- O “0 insumos” não vem da aba Complementos em si. Ele aparece no editor do produto porque `src/components/admin/ProductsGrid.tsx` lê os complementos do produto por `product_extras -> product_extra_ingredients`.
- Em `src/components/admin/ComplementosTab.tsx`, hoje a cópia dos insumos só acontece para `productsToAdd`.
- Se o produto já estava vinculado antes, ou se depois o item/categoria foi editado, os `product_extras` antigos continuam sem `product_extra_ingredients`.
- Resultado: na categoria os insumos estão corretos em `extra_category_item_ingredients`, mas dentro do produto os clones continuam vazios, então aparece “0 insumos” e o estoque não baixa.

Plano seguro
1. `src/components/admin/ComplementosTab.tsx`
   - Extrair um helper de sincronização da categoria.
   - Esse helper vai:
     - buscar `extra_category_items` com `extra_category_item_ingredients`
     - localizar os produtos vinculados à categoria
     - apagar apenas os `product_extra_ingredients` e `product_extras` daquela `extra_category_id`
     - recriar os `product_extras`
     - recriar os `product_extra_ingredients`
   - Em vez de “adicionar só os novos”, a categoria será reconstruída inteira para os produtos vinculados. Isso é mais estável e também corrige os que já estão quebrados.

2. Ainda em `ComplementosTab.tsx`
   - Chamar esse helper em:
     - `handleSaveCategory`
     - `handleSaveItem`
     - `handleDeleteItem`
   - Assim, qualquer alteração no item, preço ou insumos da categoria propaga para todos os produtos vinculados sem precisar entrar produto por produto.

3. Reparo dos dados já quebrados
   - Criar uma migração de reparo única para reconstruir os `product_extras` com `extra_category_id is not null` usando as categorias atuais.
   - Escopo restrito:
     - corrige apenas complementos vinculados por categoria
     - não toca extras avulsos (`extra_category_id` nulo)
     - não toca ingredientes fixos do produto
     - não mexe em iFood, Delivery Direto, fiscal, nem cardápio delivery

4. Estabilidade
   - Não vou mexer no layout do produto.
   - Não vou alterar `ProductsGrid.tsx` além do necessário para leitura já existente; com os dados corretos, o “0 insumos” desaparece sozinho.
   - A correção fica isolada no fluxo de sincronização da aba Complementos + reparo de dados atuais.

QA após implementar
- Abrir uma categoria em Complementos e validar que os itens têm insumos.
- Abrir um produto já vinculado e confirmar que os complementos não aparecem mais como “0 insumos”.
- Fazer um pedido PDV com os complementos afetados e confirmar baixa em `stock_movements`.
- Editar um insumo na categoria, salvar e reabrir o produto para validar sincronização automática.
- Confirmar que extras avulsos e produtos sem categoria vinculada continuam intactos.

Impacto esperado
- Corrige o problema atual dos dados quebrados.
- Evita que o bug volte quando a categoria for editada no futuro.
- Mantém o restante do sistema isolado, com risco baixo porque tudo será filtrado por `extra_category_id`.
