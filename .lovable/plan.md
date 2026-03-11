

## Plano: Correções e Melhorias no Painel (Cores, Pagamento, Fiscal, Produtos)

Este plano aborda todos os pontos levantados, divididos em blocos independentes.

---

### 1. Cores do Kanban — Tons de Laranja

**Problema**: As colunas do Kanban usam cores variadas (amber, blue, purple, green, red).

**Solução**: Substituir por tons de laranja no `UnifiedOrdersTab.tsx`:
- Aguardando: `bg-orange-400`
- Preparando: `bg-orange-500`
- Saiu/Pronto: `bg-orange-600`
- Entregue: `bg-orange-700`
- Cancelado: `bg-orange-300` (tom claro, dessaturado)

Mesma lógica para badges e cards que usam cores fora do sistema laranja.

**Arquivo**: `src/components/admin/UnifiedOrdersTab.tsx` (linhas 288-297)

---

### 2. Bug no Pagamento — "Valor maior que o restante"

**Problema**: No `PaymentConfirmationModal.tsx`, a validação `amount > remaining` usa comparação de ponto flutuante que falha com centavos (ex: 25.00 vs 24.999999...).

**Solução**: Arredondar a comparação com tolerância:
```typescript
if (amount > remaining + 0.01) {
  toast.error("Valor maior que o restante");
  return;
}
// Se o valor for ~igual ao restante, ajustar para remaining exato
const adjustedAmount = Math.min(amount, remaining);
```

Também adicionar botão "Pagar Total" que auto-preenche o valor restante.

**Arquivo**: `src/components/admin/PaymentConfirmationModal.tsx` (linhas 128-141)

---

### 3. Impressão Automática — Esclarecimento

A impressão automática funciona **sem módulo externo** — usa `window.print()` do navegador com o template térmico de `printOrder.ts`. Quando `auto_print_orders` está ativado, ao aceitar um pedido, o `OrderDetailModal` abre automaticamente o diálogo de impressão do navegador. Funciona em qualquer impressora configurada no sistema operacional. Não precisa de módulo adicional para funcionar no navegador web.

---

### 4. Pagamento de Pedidos Antigos no TableOrdersDrawer

**Problema**: O drawer de mesa mostra todos os pedidos mas não reflete pagamentos já feitos. Pedidos que já foram pagos (status `delivered`/`picked_up` com `payment_type` preenchido) ainda aparecem como "Confirmar pagamento".

**Solução**: No `TableOrdersDrawer.tsx`, ao renderizar o badge de pagamento, verificar se `order.payment_type` já está preenchido. Se sim, mostrar "Pago - [método]" em vez de "Confirmar pagamento". Também buscar pedidos com status `delivered` para mostrar histórico corretamente.

**Arquivo**: `src/components/admin/TableOrdersDrawer.tsx`

---

### 5. Deslogar Cliente ao Desativar "Pedir Conta" e ao Pagar pelo Painel

**Problema**: Quando o admin finaliza pagamento pela aba Pedidos > Mesas > clica no pedido > confirma pagamento, o cliente no cardápio digital não é deslogado.

**Solução**: Já existe o fluxo via Realtime que escuta mudanças na tabela `bills`. Quando o pagamento é confirmado via `PaymentConfirmationModal`, precisa **criar um registro na tabela `bills`** com status `paid` para que o listener do `Menu.tsx`/`Comanda.tsx` detecte e faça o logout automático. Atualmente o `PaymentConfirmationModal` só atualiza o `payment_type` no pedido — falta criar o bill.

**Modificação**: No `handleConfirmPayment` do `PaymentConfirmationModal.tsx`, após atualizar o pedido, inserir um registro em `bills` com status `paid` se o pedido for do tipo local (tem `table_id`).

**Arquivo**: `src/components/admin/PaymentConfirmationModal.tsx`

---

### 6. Impressão de Nota Fiscal (botão Imprimir no NotasFiscaisTab)

**Problema**: Não existe botão de imprimir nota fiscal na lista de notas.

**Solução**: Adicionar ícone de impressora ao lado dos botões de download PDF/XML no `NotasFiscaisTab.tsx`. Ao clicar, abre o PDF da nota em nova aba e aciona `window.print()`, ou se não houver PDF, gera um recibo simples com os dados da nota.

**Arquivo**: `src/components/admin/NotasFiscaisTab.tsx` (linhas 271-295)

---

### 7. Emissão de NFC-e para Delivery — CPF e Endereço obrigatórios

**Problema**: Pela lei, quando o pedido é entrega, a NFC-e precisa ter CPF e endereço do destinatário.

**Solução**: No `NovaEmissaoModal.tsx`, ao clicar "Emitir" num pedido de delivery:
1. Abrir um mini-modal/checkbox: "Este pedido é de entrega"
2. Se marcado, mostrar campos de CPF e Endereço auto-preenchidos com os dados do pedido (`customer_cpf`, `delivery_address`)
3. Se o CPF não existir ou for `000.000.000-00`, o usuário precisa desmarcar o checkbox para emitir como não-entrega
4. Passar esses dados para a edge function `focusnfe-emit`

**Também**: Atualizar a edge function `focusnfe-emit/index.ts` para aceitar e incluir o endereço do destinatário (`endereco_destinatario`, `municipio_destinatario`, etc.) quando fornecido.

**Arquivos**: `src/components/admin/NovaEmissaoModal.tsx`, `supabase/functions/focusnfe-emit/index.ts`

---

### 8. Código PDV em Produtos + Aba Fiscal no Dialog de Produto

**Problema**: Não existe campo de código PDV nem dados fiscais por produto.

**Solução**:

**Migration SQL** — Adicionar colunas na tabela `products`:
```sql
ALTER TABLE products ADD COLUMN pdv_code text;
ALTER TABLE products ADD COLUMN fiscal_ncm text;
ALTER TABLE products ADD COLUMN fiscal_exception text;
ALTER TABLE products ADD COLUMN fiscal_cest text;
ALTER TABLE products ADD COLUMN fiscal_cfop text;
ALTER TABLE products ADD COLUMN fiscal_icms_csosn text;
ALTER TABLE products ADD COLUMN fiscal_icms_origin text DEFAULT '0';
ALTER TABLE products ADD COLUMN fiscal_pis_cst text;
ALTER TABLE products ADD COLUMN fiscal_pis_aliquota numeric;
ALTER TABLE products ADD COLUMN fiscal_cofins_cst text;
ALTER TABLE products ADD COLUMN fiscal_cofins_aliquota numeric;
ALTER TABLE products ADD COLUMN fiscal_ibs_aliquota numeric;
ALTER TABLE products ADD COLUMN fiscal_cbs_aliquota numeric;
ALTER TABLE products ADD COLUMN fiscal_beneficio_code text;
ALTER TABLE products ADD COLUMN fiscal_indice_producao numeric;
ALTER TABLE products ADD COLUMN fiscal_aliquota_transparencia numeric;
```

**Dialog de Produto** — No `ProductsTab.tsx`:
- Alargar o dialog (`max-w-4xl`)
- Adicionar `Tabs` com duas abas: "Produto" (conteúdo atual) e "Fiscal"
- A aba Fiscal terá os campos: NCM, Exceção TIPI, CEST, Alíquota Transparência, Código Benefício Fiscal, Índice de Produção, ICMS (CST/CSOSN, Origem), IBS, CBS, PIS (Situação Tributária, Alíquota), COFINS (Situação Tributária, Alíquota), e o campo **Código PDV**
- Todos opcionais

**Arquivo principal**: `src/components/admin/ProductsTab.tsx` (dialog de criação/edição, handleSubmit, openEditDialog, resetForm)

---

### 9. Atualizar `focusnfe-emit` para usar dados fiscais do produto

Atualmente a edge function usa NCM genérico `2106.90.90` hardcoded. Com os novos campos, buscar os dados fiscais do produto e usar se disponíveis, senão fallback para os valores padrão.

**Arquivo**: `supabase/functions/focusnfe-emit/index.ts`

---

### Resumo de Arquivos

**Migration SQL**: 1 migration com ~16 colunas novas em `products`

**Modificar**:
- `src/components/admin/UnifiedOrdersTab.tsx` — cores laranja
- `src/components/admin/PaymentConfirmationModal.tsx` — fix float, criar bill ao pagar
- `src/components/admin/TableOrdersDrawer.tsx` — mostrar status pagamento correto
- `src/components/admin/NotasFiscaisTab.tsx` — botão imprimir nota
- `src/components/admin/NovaEmissaoModal.tsx` — checkbox entrega + CPF/endereço
- `src/components/admin/ProductsTab.tsx` — dialog mais largo, aba fiscal, código PDV
- `supabase/functions/focusnfe-emit/index.ts` — dados fiscais por produto + endereço destinatário

