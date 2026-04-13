

## Plano: Validação de CPF/telefone nos cardápios + edição de perfil no delivery

### 1. Validação de telefone

Criar função `validatePhone` em `src/lib/cpfValidator.ts` (ou novo arquivo) que valida:
- Número tem 10 ou 11 dígitos (fixo ou celular)
- DDD válido (11-99)
- Se 11 dígitos, deve começar com 9 no nono dígito

### 2. Adicionar validação de telefone no `CustomerInfoDialog.tsx`

- Importar `validatePhone`
- No `handleSubmit`, antes de prosseguir, validar o telefone se preenchido: se não passar, mostrar erro "Número de telefone inválido"
- Mesmo se `requirePhone` for false, se o usuário digitou algo, validar

### 3. Adicionar validação de telefone no `KioskIdentification.tsx`

- Mesma lógica: se telefone preenchido, validar antes de submeter

### 4. Tornar perfil editável no delivery (`ProfileView.tsx`)

Atualmente nome e CPF estão `disabled`. Mudanças:

- **Nome**: tornar editável com botão "Salvar" que atualiza na tabela `customers` e chama `onNameUpdate`
- **Telefone**: adicionar campo editável, buscar do `customers` table, salvar com validação
- **CPF**: manter como somente leitura (é identificador do cliente, não deve mudar)

Adicionar prop `onPhoneUpdate` e `onCpfUpdate` se necessário, ou apenas `onProfileUpdate(name, phone)`.

### 5. Propagar atualizações no `DeliveryMenu.tsx`

- Expandir `ProfileView` props para incluir `customerPhone` e callback `onProfileUpdate`
- Atualizar `sessionStorage` com novos valores quando perfil for editado

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/cpfValidator.ts` | Adicionar `validatePhone()` |
| `src/components/menu/CustomerInfoDialog.tsx` | Validar telefone no submit |
| `src/components/kiosk/KioskIdentification.tsx` | Validar telefone no submit |
| `src/components/menu/ProfileView.tsx` | Tornar nome e telefone editáveis, salvar no banco |
| `src/pages/DeliveryMenu.tsx` | Passar phone props e handler de atualização ao ProfileView |

### Resultado
- CPF já é validado nos dois fluxos (mesa e delivery) — mantido
- Telefone passa a ser validado em todos os pontos de entrada
- Perfil no delivery permite editar nome e telefone com salvamento no banco

