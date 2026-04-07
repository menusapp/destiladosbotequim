

# Plano: Corrigir 6 Erros de Segurança + Pagamento Online

## Diagnóstico

### Erros de segurança

| # | Erro | Status real |
|---|---|---|
| 1 | `fiscal_configs` publicly readable | **NÃO CORRIGIDO** — ainda tem `USING(true)`, expõe senhas de certificado e CSC |
| 2 | Realtime channels sem RLS | **Limitação arquitetural** — `customers` já foi removido; `orders`, `comandas` etc. não podem ser removidos sem quebrar o sistema |
| 3 | Password hashes públicos (`ceo_users`, `restaurant_staff`, `restaurant_credentials`) | **JÁ CORRIGIDO** — todas têm `USING(false)`. Finding antigo/stale |
| 4 | `customers` CPF/phone público | **NÃO CORRIGIDO** — ainda `USING(true)`, mas usado por 15+ arquivos (menu, admin, marketing). Bloquear quebraria tudo |
| 5 | MercadoPago tokens públicos | **JÁ CORRIGIDO** — `online_payment_config` tem `USING(false)` |
| 6 | Fiscal certificates storage sem scoping | **JÁ CORRIGIDO** — policies com path scoping existem |

### Pagamento online não aparece no delivery

O banco mostra que o restaurante ativo (`8947a1f1...`) tem `connection_status: disconnected` e `mp_access_token: NULL`. Existe uma OUTRA config conectada, mas é de outro restaurante (`9a786bc0...`). Isso significa que a conexão OAuth foi feita a partir do painel de outro restaurante, ou o callback salvou no config errado. **Não é bug de código** — é uma questão de configuração. Você precisa reconectar o Mercado Pago a partir do painel do restaurante correto.

---

## Ações concretas

### 1. `fiscal_configs` — Bloquear acesso direto (NOVO)

Mesmo padrão usado para `online_payment_config`:

**Migration SQL:**
- Criar RPC `admin_get_fiscal_config(p_restaurant_id)` — retorna todos os campos
- Criar RPC `admin_upsert_fiscal_config(p_restaurant_id, p_data jsonb)` — faz upsert
- Criar RPC `admin_update_fiscal_config(p_restaurant_id, p_field, p_value)` — atualiza campo individual
- Trocar policy para `USING(false)` / `WITH CHECK(false)`

**Frontend (`FiscalSettingsTab.tsx`):**
- Substituir `supabase.from("fiscal_configs").select(...)` por `supabase.rpc("admin_get_fiscal_config", ...)`
- Substituir `.upsert(...)` por `supabase.rpc("admin_upsert_fiscal_config", ...)`
- Substituir `.update(...)` por `supabase.rpc("admin_update_fiscal_config", ...)`

**Risco de quebra:** Baixo. Apenas `FiscalSettingsTab.tsx` usa esta tabela. Edge functions (nuvem-fiscal-*) usam `service_role` que ignora RLS.

### 2. `customers` — Documentar como risco aceito

A tabela `customers` é usada por 15+ componentes tanto no menu digital (anon) quanto no admin. Inclui lookups por CPF no checkout, CRM, marketing, etc. Como o sistema opera sem Supabase Auth sessions, não há como usar `auth.uid()` para scoping.

**Ação:** Marcar como risco aceito (ignore) com justificativa técnica detalhada. A mitigação real requer migração para Supabase Auth — refatoração arquitetural grande.

### 3. Findings antigos/stale — Deletar/Ignorar

- **Password hashes** (erro 3): Já corrigido. Deletar finding.
- **MercadoPago tokens** (erro 5): Já corrigido. Deletar finding.
- **Fiscal certs storage** (erro 6): Já corrigido com path scoping. Deletar finding.
- **Realtime channels** (erro 2): Não pode ser removido sem quebrar funcionalidades core. Marcar como risco aceito.

### 4. Pagamento online — Verificação

O problema não é de código. O restaurante `8947a1f1...` precisa reconectar o Mercado Pago. Vá em **Configurações → Pagamentos Online → Conectar com Mercado Pago** e refaça o fluxo OAuth.

---

## Resumo de arquivos a alterar

| Arquivo | Mudança |
|---|---|
| Migration SQL | RPCs para `fiscal_configs` + trocar policy |
| `src/components/admin/FiscalSettingsTab.tsx` | Usar RPCs em vez de queries diretas |

## O que NÃO será alterado
- Nenhum fluxo de pedidos, estoque, impressão
- Edge Functions existentes (acessam via service_role)
- Tabela `customers` (risco aceito)
- Realtime de `orders` e `comandas` (risco aceito)
- Código de pagamento online (funciona corretamente — é config)

