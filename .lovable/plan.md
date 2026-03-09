

## Plano: Profissionalizar Painéis CEO/Dev + Correções de Assinaturas + Conta Admin Rods

### 1. Visual Profissional nos Painéis CEO e Dev

Os painéis usam gradientes coloridos (amber/blue) nos títulos e cards com ícones grandes. Vou:
- Trocar os gradientes de texto por cores sólidas neutras (foreground)
- Reduzir tamanho dos ícones nos cards de stats
- Usar cores mais discretas e profissionais (cinza/slate em vez de amber/blue/green)
- Remover `bg-gradient-to-br` dos backgrounds, usar fundo limpo
- Manter a identidade laranja (#FF6B00) do sistema, sem rosa

**Arquivos:** `CEODashboard.tsx`, `DevDashboard.tsx`

### 2. Remover Cores Primária/Secundária do Formulário de Restaurante (CEO)

O usuário não entende para que servem — e o restaurante já pode configurar isso dentro do próprio painel. Vou remover os campos de cor do dialog de criação/edição de restaurante no CEO.

**Arquivo:** `CEODashboard.tsx`

### 3. Corrigir Lógica de Assinaturas: 1 por Restaurante

**Problema:** Ao criar nova assinatura, as antigas (suspensas/canceladas) ficam listadas, causando duplicatas e contagem errada de inadimplentes.

**Solução:**
- **`SubscriptionsTab.tsx`**: Ao criar nova assinatura para um restaurante, cancelar automaticamente todas as assinaturas anteriores desse restaurante antes de inserir a nova
- Filtrar a listagem para mostrar apenas a assinatura mais recente por restaurante (agrupar por `restaurant_id`, pegar a mais recente)
- **`CEODashboard.tsx`**: Na contagem de inadimplentes, considerar apenas a assinatura mais recente de cada restaurante (se a mais recente estiver ativa, não é inadimplente)

### 4. Dev Panel — Adaptar Versões para Web

O VersionsTab atual tem campos de download URL por plataforma (Windows/Mac/Linux) que eram para o Tauri. Como agora é web:
- Substituir os 3 campos de URL por um único campo "Changelog / Release Notes" mais proeminente
- Adicionar campo "URL do Build" (single URL for the web deploy zip)
- Manter o conceito de "Versão Atual" para controle

**Arquivo:** `VersionsTab.tsx`, `DevDashboard.tsx`

### 5. Dev Panel — Ativar Configurações Remotas

Substituir o placeholder de "Configurações Remotas" por uma interface funcional de feature flags / configs. Criar uma tabela `remote_configs` para armazenar key-value configs e uma UI simples de CRUD.

**Migration:** Criar tabela `remote_configs` (id, key, value, description, is_active, created_at, updated_at)
**Novo arquivo:** `src/components/dev/RemoteConfigsTab.tsx`
**Editar:** `DevDashboard.tsx`

### 6. Criar Conta Admin para o Restaurante "Rods"

O restaurante "rods" (ID: `8947a1f1-eaee-4f15-90eb-dad7c2a0339a`) existe mas não tem conta staff. Vou inserir via migration:
- Username: `admin`
- Password: `admin123`
- Role: `admin`
- Display name: `Administrador`
- allowed_sections: todas as seções

### Arquivos a editar/criar

- **Editar:** `src/pages/CEODashboard.tsx` — visual profissional, remover cores, fix inadimplentes
- **Editar:** `src/pages/DevDashboard.tsx` — visual profissional
- **Editar:** `src/components/ceo/SubscriptionsTab.tsx` — 1 assinatura por restaurante
- **Editar:** `src/components/dev/VersionsTab.tsx` — adaptar para web
- **Criar:** `src/components/dev/RemoteConfigsTab.tsx` — feature flags
- **Migration 1:** Tabela `remote_configs` + seed configs iniciais
- **Migration 2:** Inserir conta admin staff para restaurante rods

### Credenciais do Rods

Para logar no restaurante Rods:
1. Tela inicial: `rods` / `rods123` (credenciais do restaurante — verificar a senha real)
2. Tela de staff: `admin` / `admin123`

