

## Plano: Substituir Focus NFe por Nuvem Fiscal na emissão de NFC-e

O projeto tem **duas integrações fiscais**: `focusnfe-emit` (Focus NFe, que nunca funcionou pois não tem token configurado) e `nuvem-fiscal-company` (Nuvem Fiscal, que já tem credenciais e sincroniza empresa). A emissão de notas precisa usar a **Nuvem Fiscal**.

---

### 1. Criar edge function `nuvem-fiscal-emit`

Nova edge function que emite NFC-e via API da Nuvem Fiscal:
- Autentica via OAuth2 (mesmas credenciais `NUVEM_FISCAL_CLIENT_ID` / `NUVEM_FISCAL_CLIENT_SECRET` que já existem)
- Busca dados fiscais do restaurante em `fiscal_configs`
- Busca pedido + itens + extras
- Monta payload NFC-e conforme API Nuvem Fiscal (`POST /nfce`)
- Salva resultado (status, ref, número, URLs) em `order_fiscal_notes`

**Arquivo**: `supabase/functions/nuvem-fiscal-emit/index.ts`

---

### 2. Modificar `NovaEmissaoModal.tsx` — Chamar a nova edge function

Após inserir registro em `order_fiscal_notes`, chamar `supabase.functions.invoke('nuvem-fiscal-emit', { body: { order_id, restaurant_id } })` e atualizar o status da nota com o resultado.

---

### 3. Adicionar botão "Retentar" em `NotasFiscaisTab.tsx`

Nas notas com status `error` ou `pending`, adicionar botão para retentar chamando `nuvem-fiscal-emit` novamente.

---

### 4. Atualizar webhook do MercadoPago

Em `mercadopago-webhook/index.ts`, trocar a chamada de `focusnfe-emit` para `nuvem-fiscal-emit`.

---

### 5. Remover `focusnfe-emit` (opcional, limpeza)

Deletar a edge function `focusnfe-emit` que nunca teve credenciais configuradas.

---

### Resumo de Arquivos

**Criar**: `supabase/functions/nuvem-fiscal-emit/index.ts`
**Modificar**: `NovaEmissaoModal.tsx`, `NotasFiscaisTab.tsx`, `mercadopago-webhook/index.ts`
**Deletar**: `supabase/functions/focusnfe-emit/index.ts`

