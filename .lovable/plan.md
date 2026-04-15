

## Plano: Vincular todos os complementos a todos os produtos do Julio's Lanches

### Contexto
O restaurante `julios-lanches` possui **114 produtos** e **3 categorias de complementos**:
- Adicionais de Proteína
- Adicionais de Queijo
- Outros Adicionais

Atualmente, quase nenhum produto tem esses complementos vinculados.

### O que será feito
Executar um script SQL (via migration) que insere na tabela `product_extras` um registro para cada combinação de produto × categoria de complemento que ainda não exista, vinculando todas as 3 categorias a todos os 114 produtos.

Cada registro será criado com:
- `is_required = false` (opcional)
- `price = 0` (preço vem dos itens da categoria)
- `name` = nome da categoria de complemento

### Arquivo alterado
- 1 migration SQL — `INSERT INTO product_extras ... SELECT` com filtro `WHERE NOT EXISTS` para evitar duplicatas

### Impacto
Apenas o restaurante `c9740e47-...` (julios-lanches) será afetado. Nenhum outro restaurante é tocado.

