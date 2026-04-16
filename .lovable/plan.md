

## Correção: "column oie.quantity does not exist"

### Problema
As funções de banco `process_order_stock_movement` e `deduct_stock_for_order_item` referenciam `oie.quantity` na tabela `order_item_extras`, mas essa coluna **não existe**. Isso causa erro ao avançar pedidos para "entregue" ou "retirado".

### Solução
Uma única migration SQL que faz `CREATE OR REPLACE FUNCTION` nas duas funções, trocando:
```sql
COALESCE(oie.quantity, 1) AS qty
```
por:
```sql
1 AS qty
```

### Impacto
- **Zero risco de quebra**: a coluna nunca existiu, então nenhum código depende dela. O valor `1` já era o comportamento esperado (cada registro = 1 extra).
- **Nenhuma alteração de tabela** — apenas correção de funções existentes.
- **Nenhuma alteração no frontend** — o problema é 100% no banco de dados.

### Arquivo
- Nenhum arquivo de código alterado
- 1 migration SQL via ferramenta de banco

