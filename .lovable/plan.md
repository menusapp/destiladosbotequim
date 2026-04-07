

# Correção de RLS — restaurant_staff e online_payment_config

## Diagnóstico

Ambas as tabelas têm uma única policy `block_direct_access` com `USING(false) / WITH CHECK(false)` que bloqueia **todas** as operações diretas (SELECT, INSERT, UPDATE, DELETE). Isso é intencional para segurança, pois o sistema opera com role `anon`.

O problema: **o código faz queries diretas** nessas tabelas em vez de usar as RPCs `SECURITY DEFINER` que já existem.

### restaurant_staff — operações que falham

| Arquivo | Operação | Linha | RPC existente |
|---|---|---|---|
| `StaffLogin.tsx` | `SELECT` (verificar se há staff) | ~38 | `admin_check_has_staff` |
| `StaffLogin.tsx` | `INSERT` (criar primeiro staff) | ~95 | `admin_create_first_staff` |
| `ContasTab.tsx` | `SELECT` (listar staff) | ~51 | **não existe** — criar |
| `ContasTab.tsx` | `INSERT` (criar staff) | ~140 | **não existe** — criar |
| `ContasTab.tsx` | `UPDATE` (editar staff) | ~114 | **não existe** — criar |
| `ContasTab.tsx` | `UPDATE` (toggle ativo) | ~178 | **não existe** — criar |
| `CEODashboard.tsx` | `INSERT` (criar admin ao registrar) | ~164 | **não existe** — criar |

**Por que aparece "primeiro acesso"**: o `SELECT` na linha 38 do StaffLogin retorna vazio (bloqueado pela RLS), então `hasStaff = false` → `isFirstTime = true`.

### online_payment_config — operações que falham

| Arquivo | Operação | Linha | RPC existente |
|---|---|---|---|
| `OnlinePaymentsSettings.tsx` | `SELECT` (ler config) | ~55 | `admin_get_payment_config` |
| `OnlinePaymentsSettings.tsx` | `UPSERT` (criar config) | ~86 | `admin_ensure_payment_config` |
| `OnlinePaymentsSettings.tsx` | `UPDATE` (toggles) | ~130 | `admin_upsert_payment_config` |
| `OnlinePaymentsSettings.tsx` | `UPDATE` (sandbox email) | ~151 | `admin_upsert_payment_config` |
| `OnlinePaymentsSettings.tsx` | `DELETE` (desconectar) | ~170 | `admin_delete_payment_config` |

## Solução

A solução correta NÃO é alterar as policies RLS (que estão certas). É **migrar o código para usar as RPCs existentes** e criar novas RPCs para as operações do ContasTab/CEODashboard que não têm RPC ainda.

### 1. Criar novas RPCs (migration SQL)

- `admin_list_staff(p_restaurant_id)` — retorna todos os staff do restaurante
- `admin_upsert_staff(p_restaurant_id, p_id, p_username, p_password_hash, p_display_name, p_role, p_allowed_sections)` — cria ou atualiza staff
- `admin_toggle_staff_active(p_staff_id, p_restaurant_id)` — toggle is_active

Todas com `SECURITY DEFINER` e `SET search_path = public`.

### 2. Alterar StaffLogin.tsx

- Linha 38: trocar `supabase.from("restaurant_staff").select(...)` por `supabase.rpc("admin_check_has_staff", { p_restaurant_id: restaurantId })`
- Linha 95: trocar `supabase.from("restaurant_staff").insert(...)` por `supabase.rpc("admin_create_first_staff", { ... })`

### 3. Alterar ContasTab.tsx

- `fetchStaff`: trocar select direto por `supabase.rpc("admin_list_staff", { p_restaurant_id: restaurantId })`
- `handleSubmit` (insert/update): trocar por `supabase.rpc("admin_upsert_staff", { ... })`
- `handleToggleActive`: trocar por `supabase.rpc("admin_toggle_staff_active", { ... })`

### 4. Alterar CEODashboard.tsx

- Linha 164: trocar insert direto por `supabase.rpc("admin_create_first_staff", { ... })` (reutilizar a RPC existente, mas precisa remover a validação "staff já existe" pois no CEO é criação junto com restaurante)
- Alternativa: criar RPC `admin_create_staff` sem essa restrição, ou ajustar `admin_create_first_staff` para ser mais flexível.

### 5. Alterar OnlinePaymentsSettings.tsx

- `fetchConfig`: usar `admin_get_payment_config`
- `handleStartOAuth`: usar `admin_ensure_payment_config`
- `handleToggle` e `handleSaveSandboxEmail`: usar `admin_upsert_payment_config`
- `handleDisconnect`: usar `admin_delete_payment_config`

## Arquivos impactados

| Arquivo | Tipo |
|---|---|
| Migration SQL | Criar 3 novas RPCs |
| `src/pages/StaffLogin.tsx` | Migrar 2 queries para RPCs |
| `src/components/admin/ContasTab.tsx` | Migrar 4 queries para RPCs |
| `src/pages/CEODashboard.tsx` | Migrar 1 query para RPC |
| `src/components/admin/settings/OnlinePaymentsSettings.tsx` | Migrar 5 queries para RPCs |

## O que NÃO muda

- Policies RLS (ficam como estão — `block_direct_access`)
- Edge functions
- Fluxo de pedidos, estoque, fiscal
- Nenhuma tabela aberta com `USING(true)`

## Resultado esperado

- Login do restaurante funciona normalmente (não aparece mais como "primeiro acesso")
- Staff login funciona
- Gestão de contas (ContasTab) funciona
- Conexão com Mercado Pago funciona
- Segurança mantida — acesso somente via RPCs SECURITY DEFINER

