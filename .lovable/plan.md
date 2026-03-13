

## Plano: Reestruturação de múltiplas abas + reservas nas mesas + configurações gerais

### 1. Renomear "Dados da Empresa" → "Configurações Gerais" e adicionar sub-aba "Cardápio"

**Arquivos**: `AppSidebar.tsx`, `CompanyDataSettings.tsx`

- No sidebar, renomear `config-dados` label de "Dados da Empresa" para "Configurações Gerais"
- No `CompanyDataSettings.tsx`, adicionar 4a tab "Cardápio" com:
  - Toggle "Permitir clientes pedirem conta" (`bill_request_enabled`) — movido da aba Reservas (`TablesTab.tsx`)
  - Remover esse toggle de `TablesTab.tsx`
- Atualizar título do header para "Configurações Gerais"
- Fetch/save `bill_request_enabled` junto com as outras settings

### 2. Mostrar "Reservado para XX horas" nas mesas do PDV

**Arquivo**: `PDVTab.tsx`

- Adicionar query para buscar reservas confirmadas do dia (`status = 'confirmed'`, `reservation_date = today`)
- Criar `useMemo` mapeando `table_id → reservation_time`
- No card da mesa (quando não ocupada), exibir badge "Reservado XX:XX" em amarelo/amber se houver reserva confirmada para aquela mesa no dia
- Quando admin clicar "Limpar Mesa" ou "O cliente chegou" (no fluxo existente), a reserva é consumida normalmente

### 3. Compactar "Horário de Funcionamento"

**Arquivo**: `BusinessHoursSettings.tsx`

- Remover cards separados, unificar em layout compacto
- Toggle de automação inline no header (não em card separado)
- Dias da semana em formato de tabela compacta (não cards grandes com padding p-4)
- Reduzir para linhas de ~40px com switch + nome abreviado (Seg, Ter...) + inputs de horário inline
- Botão salvar compacto no header

### 4. Melhorar "Módulos"

**Arquivo**: `ModulosTab.tsx`

- Adicionar ícones nos features de cada plano
- Melhorar header com descrição mais rica
- Adicionar visual de "comparação" — destacar features extras de planos superiores
- Badge "Popular" mais destacado com gradiente

### 5. Melhorar "Marketing"

**Arquivo**: `MarketingTab.tsx`

- Adicionar cards de métricas resumo no topo (total campanhas ativas, mensagens enviadas, etc.)
- Melhorar header com ícone decorativo
- Visual mais polido nos tabs

### 6. Melhorar "Fidelidade"

**Arquivo**: `FidelityTab.tsx`

- Adicionar header mais rico com descrição e ícone
- Cards de resumo rápido (programas ativos, clientes fidelizados, cupons ativos)

### 7. Melhorar "Relatórios"

**Arquivo**: `ReportsTab.tsx`

- Melhorar header com tracking/font refinado
- Cards de métricas com visual mais limpo (remover gradientes pesados, usar borders sutis)
- DRE com visual mais profissional (alternating rows, melhor tipografia)

### 8. Melhorar "Margens"

**Arquivo**: `MargensTab.tsx`

- Header profissional com tracking
- CMV Desejado como inline no header (não card separado)
- Cards de resumo mais compactos e alinhados
- Lista de produtos com visual de tabela mais clean

### 9. Melhorar "Caixa"

**Arquivo**: `CashRegisterTab.tsx`

- Header com tracking profissional
- Cards de resumo mais compactos
- Tabs com visual padrão (remover bg-orange-100 hardcoded, usar design system)
- Formulários mais organizados

### Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `AppSidebar.tsx` | Renomear label "Dados da Empresa" → "Configurações Gerais" |
| `CompanyDataSettings.tsx` | Adicionar tab "Cardápio" com toggle bill_request_enabled, renomear título |
| `TablesTab.tsx` | Remover toggle bill_request_enabled |
| `PDVTab.tsx` | Buscar reservas do dia, mostrar "Reservado XX:XX" nas mesas |
| `BusinessHoursSettings.tsx` | Layout compacto tipo tabela |
| `ModulosTab.tsx` | Visual mais rico com ícones e comparação |
| `MarketingTab.tsx` | Cards de métricas, visual polido |
| `FidelityTab.tsx` | Header e resumo melhorados |
| `ReportsTab.tsx` | Visual profissional, tipografia refinada |
| `MargensTab.tsx` | CMV inline, layout compacto |
| `CashRegisterTab.tsx` | Design system consistente |

