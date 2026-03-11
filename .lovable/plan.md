

## Plano: Correções de Complementos, UI de Produtos, Add Items em Pedidos, Pagamento e Mesas

---

### 1. Complementos não salvam nos produtos — Diagnóstico e Correção

**Problema**: O sistema de vincular categorias de complementos (`product_complement_groups`) parece funcionar no código, mas ao editar um produto os complementos vinculados podem não carregar corretamente. Preciso verificar se o `extra_category_id` referencia corretamente e se a query de load está funcionando.

**Correção em `ProductsGrid.tsx`**:
- Verificar e corrigir o fluxo de `openEditDialog` para garantir que `linkedGroups` são populados corretamente ao abrir produto para edição
- Garantir que ao salvar (handleSubmit), o delete + insert de `product_complement_groups` usa os IDs corretos
- Adicionar tratamento de erro (toast) caso a query de load falhe silenciosamente

---

### 2. UI do Dialog de Criação de Produto — Mais orgânica e profissional

**Modificações em `ProductsGrid.tsx`**:
- Reorganizar o dialog com layout de 2 colunas: esquerda (dados básicos + imagem), direita (preços + categoria + tempo)
- Separar seções com headers visuais e ícones (Package, DollarSign, Settings)
- Usar cards internos com bordas suaves para agrupar Insumos, Complementos
- Melhorar espaçamento, tipografia e hierarquia visual
- **Mover campo "Código PDV" para a parte principal** (junto com nome/preço), não na aba Fiscal

---

### 3. Campo Código PDV nos Complementos

**Migration SQL**: Adicionar coluna `pdv_code` na tabela `extra_category_items`:
```sql
ALTER TABLE extra_category_items ADD COLUMN pdv_code text;
```

**Modificar `ComplementosTab.tsx`**:
- Adicionar campo "Código PDV" no dialog de criação/edição de item de complemento
- Salvar/carregar o campo no formulário

---

### 4. Botão "Adicionar Itens" funcional no pedido aceito/preparando

**Modificar `OrderDetailModal.tsx`**:
- O botão "Adicionar Itens" (linha ~388) atualmente é um `Button` sem `onClick`
- Condicionar visibilidade: mostrar quando `status` é `pending`, `accepted` ou `preparing`; ocultar quando `delivered`, `picked_up`, `cancelled`
- Ao clicar, abrir o `PDVProductDrawer` para selecionar produto e adicioná-lo ao pedido via insert em `order_items` + `order_item_extras`

---

### 5. Opção de mudar forma de pagamento em qualquer pedido

**Modificar `OrderDetailModal.tsx`**:
- Na seção "Pagamento" (linha ~559), quando `order.payment_type` já existe, mostrar o método atual + botão "Alterar pagamento"
- Ao clicar, abrir `PaymentConfirmationModal` novamente para re-selecionar
- No `PaymentConfirmationModal`, ao confirmar, atualizar tanto o `orders.payment_type` quanto o `cash_movements` correspondente (buscar pelo order_id ou bill_id e atualizar `payment_method`)
- Também atualizar o `bills.payment_method` se existir bill vinculado

---

### 6. Mesas em "Mesas e Reservas" — Verificar informações

**Verificar `TableDetailView.tsx`**:
- Confirmar que quando há múltiplos clientes na mesma mesa, cada comanda é mostrada separadamente com seus pedidos
- Já parece correto pela análise: busca comandas ativas e agrupa pedidos por `comanda_id`
- Verificar se o nome de cada cliente aparece corretamente diferenciado

---

### 7. TableOrdersDrawer na aba Pedidos — Separar pedidos atuais dos passados

**Modificar `TableOrdersDrawer.tsx`**:
- Buscar TODOS os pedidos da mesa (incluindo `picked_up`, `cancelled`, e de outros dias)
- Separar em 2 seções:
  - **Pedidos Atuais** (status `pending`/`accepted`/`preparing`/`ready` + `delivered` de hoje sem pagamento)
  - **Comandas/Pedidos Anteriores** (dentro de um Collapsible fechado por padrão): pedidos `delivered` com pagamento, `picked_up`, `cancelled`, ou de dias anteriores
- Agrupar pedidos por comanda (mostrar nome do cliente da comanda como header)
- Incluir resumo por comanda: total de itens, valor, status do pagamento
- Estilo similar ao `TableDetailView` mas em formato drawer lateral

---

### Resumo de Arquivos

**Migration SQL**: 1 migration adicionando `pdv_code text` em `extra_category_items`

**Modificar**:
- `src/components/admin/ProductsGrid.tsx` — UI mais profissional, mover Código PDV para aba principal, fix complementos
- `src/components/admin/ComplementosTab.tsx` — Campo Código PDV nos itens de complemento
- `src/components/admin/OrderDetailModal.tsx` — Botão "Adicionar Itens" funcional + opção alterar pagamento
- `src/components/admin/PaymentConfirmationModal.tsx` — Ao alterar pagamento, atualizar cash_movements e bills
- `src/components/admin/TableOrdersDrawer.tsx` — Separar pedidos atuais vs anteriores, agrupar por comanda

