

## Plan: Sistema de Contas com Permissões Customizáveis por Cargo

### Conceito Principal

Cada cargo vem com permissões **pré-selecionadas** (defaults), mas o admin pode customizar livremente quais seções cada conta de staff pode acessar. As permissões são salvas **por conta** (não por cargo global).

### Cargos e Defaults Pré-selecionados

```text
┌──────────────┬────────────────────────────────────────────────────────────┐
│ Cargo        │ Seções pré-selecionadas (editáveis pelo admin)            │
├──────────────┼────────────────────────────────────────────────────────────┤
│ admin        │ TODAS + "Contas" (fixo, não editável)                     │
│ gerente      │ Tudo EXCETO "Contas" e "Módulos"                          │
│ caixa        │ PDV, Caixa, Pedidos Online, Pedidos Locais                │
│ garcom       │ Pedidos Locais, Mesas e Reservas, PDV                     │
│ cozinha      │ Pedidos Online, Pedidos Locais                            │
│ atendente    │ Pedidos Online, Pedidos Locais, Clientes, Mesas e Reservas│
└──────────────┴────────────────────────────────────────────────────────────┘
```

Quando o admin cria uma conta e seleciona o cargo, as checkboxes das seções vêm pré-marcadas conforme a tabela acima. O admin pode marcar/desmarcar qualquer seção. As permissões finais ficam salvas em um campo JSONB `allowed_sections` na tabela `restaurant_staff`.

### Database (1 migration)

**Tabela `restaurant_staff`:**
- `id` uuid PK
- `restaurant_id` uuid NOT NULL
- `username` text NOT NULL
- `password_hash` text NOT NULL
- `display_name` text NOT NULL
- `role` text NOT NULL (admin, gerente, caixa, garcom, cozinha, atendente)
- `allowed_sections` jsonb NOT NULL DEFAULT '[]' (array de section IDs permitidos)
- `is_active` boolean DEFAULT true
- `created_at`, `updated_at` timestamps
- UNIQUE(restaurant_id, username)

**RPC `validate_staff_credentials`:**
- Recebe `p_restaurant_id uuid`, `p_username text`, `p_password text`
- Retorna `staff_id`, `display_name`, `role`, `allowed_sections`
- Security definer, filtra por `is_active = true`

### Fluxo de Login

1. **Landing (`/`)** — Login do restaurante (existente, sem mudança)
2. Ao logar, redireciona para **`/staff-login`** (nova página) em vez de `/admin`
3. **StaffLogin** — Campos usuário/senha, valida via RPC `validate_staff_credentials`
4. Salva em localStorage: `staff_id`, `staff_name`, `staff_role`, `staff_allowed_sections`
5. Redireciona para `/admin`

### Frontend

**Novos arquivos:**
- `src/pages/StaffLogin.tsx` — tela de login do funcionário
- `src/components/admin/ContasTab.tsx` — CRUD de contas com checkboxes de permissões
- `src/lib/staffPermissions.ts` — defaults por cargo + lista de todas as seções

**Edições:**
- `src/pages/Landing.tsx` — redirecionar para `/staff-login` após login do restaurante
- `src/App.tsx` — adicionar rota `/staff-login`
- `src/components/admin/AppSidebar.tsx` — adicionar item "Contas" (ícone Users), filtrar seções por `allowed_sections` do staff logado
- `src/pages/RestaurantAdmin.tsx` — ler `staff_role`/`staff_allowed_sections` do localStorage, passar para sidebar, renderizar `ContasTab`
- `src/components/admin/AdminHeader.tsx` — mostrar nome do staff logado, logout limpa dados do staff

**ContasTab (admin only):**
- Lista de funcionários com nome, cargo, status ativo/inativo
- Formulário de criação/edição:
  - Username, senha, nome de exibição
  - Select de cargo — ao trocar, preenche checkboxes com defaults
  - Grid de checkboxes com todas as seções do sistema (pré-marcadas pelo cargo)
  - O admin marca/desmarca livremente
- Admin pode editar suas próprias credenciais mas não pode se desativar
- Não pode criar outro admin

### Segurança
- Senhas em texto simples (mesmo padrão de `restaurant_credentials`)
- RLS: acesso anon/authenticated com `true` (mesmo padrão do projeto)
- Conta admin criada pelo CEO ao cadastrar restaurante (editar `CEODashboard.tsx`)

