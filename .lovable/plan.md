

# Plano — Performance PWA + Backup Path + Planos Atualizados

## 3 Alterações

### 1. Performance: Prefetch e transições mais rápidas entre abas

O PWA standalone não tem a barra de URL do Chrome, então a percepção de lentidão vem do tempo de carregamento dos lazy chunks + queries de cada aba. Sem alterar funcionalidades:

**Alterações em `RestaurantAdmin.tsx`:**
- Adicionar **prefetch on hover** no sidebar: quando o mouse passar sobre um item do menu, pré-carregar o chunk daquela aba via dynamic import (ex: `import("@/components/admin/StockTab")`)
- Adicionar um **skeleton de carregamento** mais visual no `Suspense fallback` em vez do texto simples "Carregando..." — usar componente Skeleton já existente no projeto para dar feedback instantâneo
- Memoizar o `renderContent()` com `useMemo` baseado no `activeSection` e `restaurant.id` para evitar re-render desnecessário

**Alterações em `AppSidebar.tsx`:**
- Adicionar `onMouseEnter` nos itens do menu para disparar prefetch do chunk correspondente (mapeamento section → import)

### 2. Backup: Campo de pasta padrão para downloads

O navegador não permite escolher programaticamente a pasta de download (limitação de segurança). Mas podemos:

**Alterações em `BackupSettings.tsx`:**
- Adicionar um campo de texto "Pasta padrão para backup" onde o usuário digita o caminho desejado (ex: `C:\Backups\Menus`) — salvo no localStorage
- Mostrar esse caminho como **lembrete visual** antes do download, com aviso: "Configure a pasta de download do seu navegador para salvar automaticamente neste local"
- Adicionar um card informativo explicando como configurar o navegador (Chrome: Configurações → Downloads → Perguntar onde salvar)
- Usar a **File System Access API** (`showDirectoryPicker`) quando disponível no navegador para permitir salvar diretamente na pasta escolhida — com fallback para download normal quando a API não estiver disponível

### 3. Planos: Sincronizar com a Landing Page

A LP define 3 planos: **Básico R$99**, **Intermediário R$199**, **Avançado R$349**. O `ModulosTab.tsx` puxa os planos do banco (`subscription_plans`). A divergência não é no código — é nos dados do banco.

**Alterações em `ModulosTab.tsx`:**
- Adicionar os detalhes textuais da LP (preço diário, lista de features em texto legível) diretamente nos cards, mapeando por nome do plano
- Exibir features tanto como módulos (badges) quanto como lista textual (igual na LP): "Cardápio digital ilimitado", "QR Code para mesas", etc.
- Adicionar o valor diário "R$ X,XX/dia" abaixo do preço mensal, igual na LP

**Alterações no `SubscriptionPlansTab.tsx` (CEO):**
- Adicionar campo "Preço diário" calculado automaticamente (price / 30) no card de visualização
- Adicionar campo de texto "Features textuais" (lista de benefícios em texto livre, além dos módulos) para o CEO configurar o que aparece na aba de planos do restaurante

## Detalhes Técnicos

| Arquivo | Alteração |
|---------|-----------|
| `RestaurantAdmin.tsx` | Prefetch on hover, Skeleton no Suspense fallback, memoização |
| `AppSidebar.tsx` | `onMouseEnter` com prefetch dinâmico por seção |
| `BackupSettings.tsx` | Campo de pasta padrão, File System Access API, card informativo |
| `ModulosTab.tsx` | Features textuais da LP, preço diário, visual alinhado com LP |
| `SubscriptionPlansTab.tsx` | Campo de features textuais, preço diário calculado |

Nenhuma funcionalidade existente será alterada. Todas as mudanças são aditivas ou visuais.

