

# Plano de Implementação — 4 Alterações

## 1. Atualizar preços dos planos

Trocar os valores hardcoded nos arquivos:

**`src/pages/LandingPage.tsx`** (linhas 57-76):
- Básico: `"99"` → `"69,90"`, daily `"R$ 3,30/dia"` → `"R$ 2,33/dia"`
- Intermediário: `"199"` → `"149,90"`, daily `"R$ 6,63/dia"` → `"R$ 5,00/dia"`
- Avançado: `"349"` → `"249,90"`, daily `"R$ 11,63/dia"` → `"R$ 8,33/dia"`

Ajustar o formato de exibição pois atualmente mostra `R$ {plan.price}/mês` com o price sendo string inteira. Com os novos valores decimais, manter coerência visual (ex: "69,90" como string no campo price, ajustar template).

## 2. Webhook de assinatura do Mercado Pago + controle de inadimplência

**Problema**: Não existe hoje um webhook que processe pagamentos de assinatura (preapproval). O webhook existente (`mercadopago-webhook`) só trata `payment.updated/created` de pagamentos avulsos de pedidos.

**Solução**:

### 2a. Criar edge function `mercadopago-subscription-webhook`
- Receber notificações do tipo `subscription_preapproval` e `subscription_authorized_payment`
- Quando pagamento de assinatura for aprovado:
  - Buscar o restaurante pelo `external_reference` ou `payer.email` configurado no plano do MP
  - Ativar/criar `restaurant_subscriptions` com `status: active`, `last_payment_at: now()`, `next_payment_at: +30 dias`
- Quando assinatura for cancelada ou pagamento falhar:
  - Marcar `restaurant_subscriptions` como `suspended`

### 2b. Adicionar coluna `mp_preapproval_id` na tabela `restaurant_subscriptions`
- Para vincular a assinatura do MP ao registro local

### 2c. Adicionar coluna `mp_payer_email` na tabela `restaurants`
- Para identificar qual restaurante está pagando via MP

### 2d. Controle de acesso por inadimplência
No frontend, no `RestaurantAdmin.tsx` ou no hook de carregamento do restaurante:
- Verificar se a assinatura ativa tem `next_payment_at < now()` (inadimplente)
- Se inadimplente, mostrar tela de bloqueio com mensagem de regularização ao invés do painel admin
- Não bloquear o cardápio digital público (apenas o painel admin)

### 2e. Fluxo Landing → Registro
Atualmente o link do MP leva direto para checkout do MP. Após pagar, não há callback que libere o registro. A solução:
- O link de assinatura do MP deve incluir `back_url` apontando para a página de registro `/registro/{plano}`
- O webhook do MP, ao confirmar pagamento, cria automaticamente a assinatura no banco

**Nota**: Isso requer que os planos no Mercado Pago (`preapproval_plan_id`) sejam reconfigurados com os novos preços e com `external_reference` ou `back_url` corretos. Isso é feito no dashboard do Mercado Pago, não no código.

## 3. Mesa visível/oculta

### 3a. Migration SQL
```sql
ALTER TABLE tables ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
```

### 3b. `ManageTablesDrawer.tsx`
- Adicionar `Switch` no formulário de edição de mesa com label "Mesa oculta"
- Salvar `is_hidden` no payload de update/insert

### 3c. `PDVTab.tsx`
- Mesas com `is_hidden = true`:
  - Exibir com o mesmo estilo visual de mesa livre (sem borda colorida, mesma tonalidade neutra)
  - Mostrar "Oculta" ao invés de "Livre" no badge
  - Não permitir clique para abrir comanda
- Mesas ocultas aparecem na grid mas são claramente marcadas como inativas

### 3d. Reservas e Cardápio
- Queries de reservas: filtrar `is_hidden = false` para não exibir mesas ocultas como opção
- QR Code de mesa oculta: na página `Comanda.tsx`, verificar `is_hidden` e mostrar mensagem "Mesa indisponível" se oculta

### 3e. `TablesTab.tsx` (Reservas)
- Filtrar mesas ocultas da lista de mesas disponíveis para reserva

## 4. Cores das mesas no PDV

### `PDVTab.tsx` (linhas 730-734 e 764-766)

**Card da mesa** (borda/fundo):
- Livre: `border-green-300 bg-green-50 dark:bg-green-950/20` (verde claro)
- Ocupada: `border-red-300 bg-red-50 dark:bg-red-950/20` (vermelho claro)
- Oculta: manter neutro como está atualmente (`border-border`)

**Círculo do número** (linhas 764-766):
- Livre: `bg-green-400`
- Ocupada: `bg-red-500`
- Oculta: `bg-muted-foreground/40` (como está hoje para "livre")

Atualmente: ocupada = verde, livre = cinza. Mudar para: ocupada = vermelho, livre = verde, oculta = cinza.

---

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/pages/LandingPage.tsx` | Preços dos planos |
| `src/components/admin/PDVTab.tsx` | Cores das mesas + lógica de mesa oculta |
| `src/components/admin/ManageTablesDrawer.tsx` | Switch de mesa oculta no form de edição |
| `src/pages/Comanda.tsx` | Bloquear acesso a mesa oculta |
| Migration SQL | `is_hidden` na tabela `tables`, `mp_preapproval_id` em `restaurant_subscriptions` |
| `supabase/functions/mercadopago-subscription-webhook/index.ts` | Novo webhook para assinaturas |
| `src/pages/RestaurantAdmin.tsx` | Bloqueio por inadimplência |
| Reservas queries | Filtrar mesas ocultas |

## O que NÃO muda
- Fluxo de pedidos existente
- Webhook de pagamentos de pedidos (mercadopago-webhook)
- Edge functions existentes
- Estoque, fiscal, integrações

