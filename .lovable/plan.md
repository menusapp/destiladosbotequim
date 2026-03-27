

## Plano: 3 Correções Urgentes

### 1. Pagamento melhorado com seleção de bandeira para cartão

**Problema**: A tela de pagamento (`PaymentConfirmationModal`) é simples demais e ao selecionar Débito/Crédito não pede para escolher a bandeira do cartão, o que é necessário para emissão de NFC-e.

**Solução**:
- Redesenhar o `PaymentConfirmationModal.tsx` com layout mais profissional:
  - Cards maiores com ícones mais visíveis para cada método
  - Quando selecionar Crédito ou Débito, abrir um sub-painel/step para escolher a bandeira (Visa, Mastercard, Elo, Amex, Hipercard, Diners)
  - Quando selecionar Vale Refeição, abrir sub-painel para escolher a bandeira (Alelo, Sodexo, Ticket, VR, Pluxee)
  - O `payment.method` gravado incluirá a bandeira (ex: "Crédito - Visa", "Débito - Mastercard")
  - Manter compatibilidade com o `methodType` para a tabela `bills` e mapeamento fiscal
- Melhorar visual geral: resumo do pedido mais claro, totais destacados, lista de pagamentos adicionados com botão de remover

### 2. Estoque não descontado em pedidos PDV

**Problema**: O trigger `process_order_stock_movement` só desconta estoque quando o status muda para `accepted`. Pedidos PDV (delivery/retirada) pulam `accepted` e vão direto para `preparing`, então o estoque nunca é descontado.

**Solução** (migração SQL):
- Atualizar a função `process_order_stock_movement()` para TAMBÉM disparar quando o status muda para `preparing` (verificando que o status anterior era `pending` ou é um INSERT novo), evitando dupla dedução
- Condição: `IF (NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted')) OR (NEW.status = 'preparing' AND (OLD IS NULL OR OLD.status NOT IN ('accepted', 'preparing', 'ready', ...)))` — basicamente, deduzir na primeira transição para `accepted` OU `preparing`, o que vier primeiro
- Isso cobre tanto pedidos normais (pending → accepted) quanto PDV (pending → preparing)

### 3. Detalhes da Nota Fiscal ao clicar

**Problema**: Não há como ver detalhes da nota emitida (chave, produtos, cliente, valores).

**Solução**:
- Criar um componente `FiscalNoteDetailSheet.tsx` (Sheet/Drawer lateral) que abre ao clicar em qualquer linha da tabela de notas
- Expandir a query `fetchNotes` para trazer também: `nfe_key`, `nuvem_fiscal_ref`, e dados completos do pedido (`payment_type`, `delivery_type`, `order_items.products.name`)
- O sheet exibirá:
  - Status da nota com badge
  - Chave de acesso (nfe_key) com botão de copiar
  - Número da nota e referência Nuvem Fiscal
  - Data de emissão
  - Dados do cliente (nome, CPF)
  - Lista de produtos com quantidades e valores
  - Forma de pagamento
  - Valor total
  - Mensagem de erro (se houver)
  - Links para PDF e XML

**Arquivos impactados**:
- `src/components/admin/PaymentConfirmationModal.tsx` — redesign com seleção de bandeira
- `src/components/admin/NotasFiscaisTab.tsx` — query expandida + clique na linha abre detalhes
- `src/components/admin/FiscalNoteDetailSheet.tsx` — novo componente
- Nova migração SQL — fix do trigger de estoque para cobrir status `preparing`

