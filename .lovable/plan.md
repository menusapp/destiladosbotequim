

## Analise Geral do Sistema -- Feedback Completo

Fiz uma varredura completa nos arquivos principais. Aqui esta o resultado:

---

### PROBLEMAS ENCONTRADOS

**1. Bug: `getCartTotal()` ignora preco promocional (Menu.tsx, linha 935-938)**
```
const getCartTotal = () => cart.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    return sum + (item.product.price + extrasTotal) * item.quantity;  // ← BUG
}, 0);
```
Usa `item.product.price` em vez de `item.product.promotional_price ?? item.product.price`. O `CartDrawer` calcula corretamente, mas o `getCartTotal` no Menu.tsx nao. Se um produto tem preco promocional, o total mostrado na barra inferior pode divergir do drawer.

**2. Bug potencial: Menu.tsx INSERT listener de bills nao filtra por comanda_id (linhas 542-562)**
O listener de INSERT em bills no Menu.tsx filtra apenas por `table_id`. Se dois clientes estao na mesma mesa e o garcom paga a comanda do Cliente A pelo PDV, o Cliente B tambem recebe o evento e e deslogado. O Comanda.tsx ja filtra corretamente por `comanda_id`, mas o Menu.tsx nao.

Solucao: No handler de INSERT de bills, verificar tambem `bill.comanda_id` contra o `comanda_id` salvo no sessionStorage.

**3. Bug potencial: Menu.tsx UPDATE listener de bills nao filtra por comanda_id (linhas 517-541)**
Mesmo problema do item 2. O UPDATE listener tambem filtra apenas por `table_id`, afetando todos os clientes da mesa.

**4. Limpeza incompleta de sessionStorage no evento de mesa esvaziada (Menu.tsx, linha 584)**
```
sessionStorage.removeItem("comanda_id");  // ← ERRADO
```
Deveria ser `sessionStorage.removeItem(\`comanda_id_${tableNumber}\`)` com template literal, igual ao restante do codigo.

**5. ReviewsDrawer: Query pode falhar se FK nao existir no counter_orders**
A query usa `counter_orders!restaurant_reviews_counter_order_id_fkey(customer_name)`. A FK existe (confirmei na migration), entao esta ok. Porem, se uma review foi criada sem `order_id` nem `counter_order_id` (ex: review de bill direta), o nome fica "Cliente" -- comportamento aceitavel.

---

### COISAS QUE ESTAO CORRETAS

- **Fluxo PDV -> Comanda.tsx**: O pagamento pelo PDV insere bill com `comanda_id` e `status='paid'`. O Comanda.tsx escuta INSERT filtrado por `comanda_id`, detecta corretamente e faz logout. Funciona.

- **Isolamento de comandas**: O PDV processa cada comanda individualmente, fecha apenas a comanda selecionada, e so libera a mesa se nao ha mais comandas ativas. Correto.

- **Realtime no Comanda.tsx**: Listeners de bills (UPDATE, INSERT, DELETE) filtram por `comanda_id`. Correto e isolado.

- **Login/Logout**: Fluxo de criacao de comanda, salvamento no sessionStorage, e restauracao de sessao estao corretos.

- **Avaliacao pos-pagamento**: O fluxo shouldShowReview -> reviewModal -> handleCompleteLogout esta completo.

- **Rota de mesas admin**: Corrigida para `/:slug/admin/mesa/:tableId`. Funciona.

- **Sidebar ativa**: Cor primaria aplicada corretamente no item ativo. Funciona.

- **ReviewsDrawer**: Query com joins esta correta, formatacao ok.

- **Inactivity logout**: Verifica pedidos/contas ativas antes de deslogar. Correto.

---

### PLANO DE CORRECOES

**Arquivo: `src/pages/Menu.tsx`**

1. **Linha 584**: Corrigir `sessionStorage.removeItem("comanda_id")` para `sessionStorage.removeItem(\`comanda_id_${tableNumber}\`)`

2. **Linhas 529-540 (UPDATE bills)**: Adicionar verificacao de `comanda_id` -- se o cliente tem comanda_id no sessionStorage, so reagir se `bill.comanda_id` bater

3. **Linhas 554-561 (INSERT bills)**: Mesma verificacao de `comanda_id`

4. **Linhas 935-938 (getCartTotal)**: Usar `item.product.promotional_price ?? item.product.price`

---

### RESUMO

O sistema esta bem robusto. Os 4 bugs encontrados sao:
- 2 criticos de isolamento entre comandas no Menu.tsx (clientes na mesma mesa podem ser deslogados indevidamente)
- 1 bug de preco promocional no calculo do total
- 1 limpeza de sessionStorage incorreta

Nenhum deles impede o teste basico com uma mesa/um cliente. So se manifestam com multiplos clientes na mesma mesa ou produtos com preco promocional.

