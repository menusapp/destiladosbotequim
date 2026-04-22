
## Toggle de visibilidade nas senhas

Adicionar ícone de olho (Eye/EyeOff do lucide-react) em todos os campos de senha do sistema, permitindo que o usuário alterne entre ver/ocultar a senha digitada. Mudança puramente visual, sem alterações em backend ou lógica de validação.

### Componente reutilizável
Criar `src/components/ui/password-input.tsx` — wrapper sobre o `<Input>` existente que:
- Mantém todas as props do Input nativo (ref, value, onChange, placeholder, required, minLength, etc.)
- Adiciona estado interno `showPassword` (boolean)
- Renderiza o input com `type={showPassword ? "text" : "password"}` e um botão posicionado à direita (`absolute right-2`) com ícone `Eye`/`EyeOff`
- `type="button"` no toggle para não submeter formulários
- `tabIndex={-1}` no botão para não atrapalhar navegação por Tab
- Padding-right extra no input para o ícone não sobrepor o texto

### Substituições (somente trocar `<Input type="password" .../>` por `<PasswordInput .../>`)

1. **`src/pages/RestaurantLogin.tsx`** — campo de login do restaurante
2. **`src/pages/CEOLogin.tsx`** — campo de login do CEO
3. **`src/pages/StaffLogin.tsx`** — 3 campos: senha do funcionário + criar nova senha do owner + confirmar senha
4. **`src/pages/RestaurantRegistration.tsx`** — 4 campos: senha/confirmar senha do restaurante + senha/confirmar do admin
5. **`src/pages/CEODashboard.tsx`** — campo "Senha do Restaurante" no formulário CEO
6. **`src/components/admin/ContasTab.tsx`** — senha de funcionário (criar/editar)
7. **`src/components/admin/IntegrationsTab.tsx`** — senha do Delivery Direto
8. **`src/components/admin/FiscalSettingsTab.tsx`** — senha do certificado fiscal (.pfx)

### O que NÃO muda
- Nenhuma lógica de autenticação, validação ou backend
- Nenhuma RPC, edge function ou tabela
- Comportamento padrão continua oculto (`type="password"`); o usuário precisa clicar no olho para revelar
