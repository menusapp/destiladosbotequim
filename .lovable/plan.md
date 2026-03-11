

## Plano: Remover Toasts dos Cardápios, Fixar Viewport, e Adicionar Itens Inline no Pedido

---

### 1. Remover toasts excessivos das páginas de cliente

**Problema**: Notificações (toasts) aparecem o tempo todo nos cardápios digitais e de mesa, atrapalhando a experiência do cliente.

**Solução**: Nas páginas `Menu.tsx`, `DeliveryMenu.tsx`, `Comanda.tsx` e `OrderConfirmation.tsx`, remover ou silenciar a maioria dos `toast.*` calls. Manter apenas:
- `toast.success` para confirmação de pedido enviado
- `toast.success` para conta paga + logout
- `toast.error` para erros críticos (mesa não encontrada, erro ao enviar pedido)

**Remover**:
- `toast.success("Bem-vindo, ...")` no login de mesa
- `toast.info("O restaurante acabou de fechar/abrir")` 
- `toast.success("... adicionado")` ao adicionar item ao carrinho
- `toast.success("Comanda limpa")`
- `toast.info("A conta está a caminho!")`
- `toast.info("A mesa foi liberada...")`
- `toast.info("Obrigado pela visita!")`
- Notificações de mudança de status do pedido (aceito, preparando, pronto) — manter apenas no painel admin

**Manter no painel admin**: Todos os toasts continuam normais para o restaurante.

**Arquivos**: `src/pages/Menu.tsx`, `src/pages/DeliveryMenu.tsx`, `src/pages/Comanda.tsx`

---

### 2. Fixar viewport — impedir zoom nos cardápios

**Problema**: Clientes conseguem dar zoom na tela do cardápio, quebrando a proporção.

**Solução**: No `index.html`, alterar a meta viewport para:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

Também adicionar CSS no `src/index.css`:
```css
html, body {
  touch-action: manipulation;
  -ms-touch-action: manipulation;
}
```

Isso impede zoom por pinch e double-tap em dispositivos móveis. Funciona tanto para cardápio digital quanto mesa.

**Arquivos**: `index.html`, `src/index.css`

---

### 3. Adicionar itens inline no pedido (sem redirecionar ao PDV)

**Problema**: Ao clicar "Adicionar Itens" no `OrderDetailModal`, aparece toast dizendo "Use o PDV" e redireciona. O usuário quer um drawer lateral com os produtos direto no modal.

**Solução — Criar componente `AddItemsToOrderDrawer`**:
- Um `Sheet` lateral que:
  1. Busca os produtos do restaurante (com `product_extras` e `product_complement_groups`)
  2. Mostra uma grid de categorias + produtos (similar ao PDV mas simplificado)
  3. Ao clicar num produto, abre o `PDVProductDrawer` existente para selecionar complementos/observações
  4. Ao confirmar, insere direto em `order_items` + `order_item_extras` via Supabase
  5. Fecha e chama `onStatusUpdate()` para atualizar os dados do pedido

**Modificar `OrderDetailModal.tsx`**:
- Importar o novo `AddItemsToOrderDrawer`
- Estado `showAddItems` para controlar abertura
- `handleAddItems` agora abre o drawer em vez de redirecionar
- O drawer recebe `orderId`, `restaurantId` e callback de refresh

**Novo arquivo**: `src/components/admin/AddItemsToOrderDrawer.tsx`
**Modificar**: `src/components/admin/OrderDetailModal.tsx` (linhas 165-171 — substituir handleAddItems)

---

### Resumo de Arquivos

**Criar**: `src/components/admin/AddItemsToOrderDrawer.tsx`

**Modificar**:
- `index.html` — viewport sem zoom
- `src/index.css` — touch-action manipulation
- `src/pages/Menu.tsx` — remover toasts desnecessários
- `src/pages/DeliveryMenu.tsx` — remover toasts desnecessários
- `src/pages/Comanda.tsx` — remover toasts desnecessários
- `src/components/admin/OrderDetailModal.tsx` — abrir drawer de adicionar itens inline

