

## Plano: Corrigir 2 Bugs Críticos

### Bug 1: Pedido de mesa mostra "Erro ao enviar" mas cria duplicado

**Causa raiz** em `src/pages/Comanda.tsx` (função `handleSendOrder`, linha 615):

1. **Sem guarda de `submitting`**: Não existe estado `submitting` — o botão "Enviar Pedido" fica clicável durante toda a operação async. Se o usuário clica novamente, um segundo pedido é criado (com itens acumulados).

2. **`order_type` não é setado**: Na linha 690, o insert em `orders` não inclui `order_type: "local"`. Isso pode causar problemas no fluxo de categorização do UnifiedOrdersTab (que filtra por `order_type === "local"`).

3. **O erro toast aparece mesmo com sucesso**: Preciso verificar se `fetchData()` na linha 742 pode estar lançando exceção (o que faria cair no `catch` e mostrar "Erro ao enviar pedido" mesmo depois do pedido já ter sido inserido).

**Correções** em `src/pages/Comanda.tsx`:
- Adicionar estado `const [submitting, setSubmitting] = useState(false)`
- Envolver `handleSendOrder` com `setSubmitting(true)` no início e `setSubmitting(false)` no finally
- Desabilitar o botão "Enviar Pedido" quando `submitting === true`
- Adicionar `order_type: "local"` ao insert do pedido
- Mover `toast.success` e `setCart([])` para DEPOIS de todos os inserts terem sucesso, e antes de `fetchData()`
- Envolver `fetchData()` em try/catch separado para não derrubar o fluxo principal

---

### Bug 2: Página principal do admin não carrega (crash)

Sem logs de console disponíveis, as causas mais prováveis são:

1. **Erro de runtime em algum componente recém-editado** — preciso adicionar error boundaries ou verificar se algum `null` está sendo acessado nos componentes editados recentemente (UnifiedOrdersTab, OrderDetailModal, TablesTab).

2. **Possível crash no `OrderDetailModal`** — as mudanças recentes de lógica de pagamento/status podem causar erro se `order.order_type` for `null` (pedidos de mesa antigos sem `order_type`).

**Correções**:
- Em `OrderDetailModal.tsx`: Garantir que todas as verificações de `order.order_type` usem fallback (ex: `order.order_type === "local" || !order.order_type` quando tem `table_id`)
- Adicionar null-safe checks em acessos que podem ser undefined
- Adicionar console.log no catch de `fetchAll` em UnifiedOrdersTab para debug

---

### Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/Comanda.tsx` | Adicionar `submitting` guard, `order_type: "local"`, proteger `fetchData()` |
| `src/components/admin/OrderDetailModal.tsx` | Null-safe checks para `order_type` |

