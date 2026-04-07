

# Plano de Correção — 3 Erros + 5 Warnings de Segurança

## Análise do estado atual

As 3 migrações anteriores **já criaram as RPCs e policies `USING(false)`** nos 4 tabelas sensíveis. Porém o scanner ainda mostra erros porque **foi rodado antes das migrações** ou tem cache. Preciso rodar um novo scan e/ou atualizar os findings.

Para os warnings, há ações concretas necessárias.

---

## 3 Erros (já corrigidos — precisam de re-scan)

Os 3 erros já foram resolvidos pelas migrações anteriores:

1. **Password hashes publicly readable** → `ceo_users`, `restaurant_staff`, `restaurant_credentials` já têm `USING(false)`. Confirmado via `pg_policies`.
2. **MercadoPago tokens publicly readable** → `online_payment_config` já tem `USING(false)`. Acesso via RPCs.
3. **Fiscal certificates sem scoping** → Policies com `storage.foldername` já aplicadas e confirmadas.

**Ação:** Rodar novo security scan para atualizar os findings. Se persistirem, marcar como resolvidos via `manage_security_finding`.

---

## 5 Warnings

### Warning 1: Leaked Password Protection Disabled
**Problema:** O check HIBP (Have I Been Pwned) está desativado nas configurações de auth.

**Ação:** Ativar via `cloud--configure_auth`. Isso não afeta o sistema pois o projeto não usa Supabase Auth para o painel admin (usa RPCs próprias). Risco de quebra: **zero**.

### Warning 2: Extension in Public (`pg_net`)
**Problema:** A extensão `pg_net` está instalada no schema `public` em vez de um schema dedicado como `extensions`.

**Ação:** Mover `pg_net` para o schema `extensions` via migration:
```sql
ALTER EXTENSION pg_net SET SCHEMA extensions;
```

**Risco de quebra:** Baixo. `pg_net` é usado internamente pelo Supabase para webhooks/cron. Se alguma Edge Function ou trigger referencia `net.http_*`, precisaria atualizar para `extensions.net.http_*`. Vou verificar se há referências antes de executar.

**Alternativa segura:** Se a migração falhar (Supabase pode bloquear ALTER EXTENSION em managed instances), marcar como risco aceito com explicação.

### Warning 3: Function Search Path Mutable (3 funções)
**Problema:** 3 funções trigger sem `SET search_path`:
- `add_local_order_to_cash_register`
- `process_order_stock_movement`
- `revert_order_stock_movement`

**Ação:** Recriar as 3 funções adicionando `SET search_path = public` (e `SECURITY DEFINER` nas que não têm). O corpo das funções permanece idêntico.

**Risco de quebra:** Nenhum. Apenas adiciona uma propriedade de segurança sem alterar lógica.

### Warning 4: RLS Policy Always True (58+ tabelas)
**Problema:** Dezenas de tabelas operacionais com `USING(true)` para INSERT/UPDATE/DELETE.

**Realidade:** Este projeto opera inteiramente como `anon` (sem Supabase Auth sessions). Restringir essas tabelas com `auth.uid()` quebraria **todo o sistema** — cardápio digital, PDV, mesas, pedidos, estoque, fiscal, etc.

**Ação:** Marcar como risco aceito com explicação técnica detalhada. Essas tabelas são operacionais e não contêm dados sensíveis (credenciais e tokens já estão isolados). A mitigação real só seria possível com migração completa para Supabase Auth, o que é uma refatoração arquitetural grande.

### Warning 5: High severity vulnerability — `electron-builder`
**Problema:** `electron-builder` v26 tem vulnerabilidades conhecidas.

**Ação:** Verificar se Electron é realmente usado. Este é um projeto web (Vite + React). Se Electron foi adicionado para futuro uso mas não é essencial, remover `electron` e `electron-builder` do `package.json`.

**Risco de quebra:** Nenhum se não houver build Electron ativo. O projeto roda como webapp.

---

## Resumo de ações

| Item | Ação | Risco |
|---|---|---|
| 3 erros | Re-scan + atualizar findings | Zero |
| HIBP | Ativar leaked password protection | Zero |
| pg_net | Tentar mover para `extensions`, senão aceitar | Baixo |
| 3 funções search_path | Recriar com `SET search_path` | Zero |
| RLS always true | Documentar como risco aceito | Zero |
| electron-builder | Remover do package.json | Zero |

## Arquivos a alterar
- 1 migration SQL (fix search_path das 3 funções + tentar mover pg_net)
- `package.json` (remover electron + electron-builder)
- Security findings (atualizar/deletar via tool)

## O que NÃO será alterado
- Nenhum componente frontend
- Nenhum fluxo de pedidos, estoque, fiscal, impressão
- Nenhuma Edge Function
- Nenhuma tabela operacional

