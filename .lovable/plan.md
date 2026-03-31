

# Plano — 6 Ajustes de Notificações e Interface

## Análise de Risco

Nenhuma funcionalidade existente será quebrada. Todos os ajustes são na camada de UI/notificação ou em preferências aditivas. Fluxos de pedidos, fiscal, iFood, pagamentos permanecem intactos.

## Ajuste 1 — Remover UI de instalação PWA

**Alterações:**
- Remover `<InstallPWA />` do `App.tsx` (linha ~47) e o import correspondente
- Deletar `src/components/InstallPWA.tsx`
- O `manifest.json` e meta tags permanecem (o app continua instalável pelo menu do navegador)

**Risco:** Zero. Apenas remove um banner visual.

---

## Ajuste 2 — Toggle de timer de preparo para mesas

O timer atual é o badge `{elapsed}min` nos cards de pedido no `UnifiedOrdersTab.tsx` (linha 278) e no PDV o `Desde {occupiedSince}` (linha 782).

**Alterações:**
- Migração: adicionar coluna `show_prep_timer boolean DEFAULT true` na tabela `restaurants`
- `UnifiedOrdersTab.tsx`: receber prop `showPrepTimer`, ocultar badge de elapsed quando `false`
- `PDVTab.tsx`: ocultar "Desde HH:mm" quando `showPrepTimer` é `false`
- `RestaurantAdmin.tsx`: buscar `show_prep_timer` do restaurante e passar como prop
- `CompanyDataSettings.tsx`: adicionar toggle "Mostrar tempo de preparo" e botão "Zerar tempo" (que reseta `occupied_at` de todas as mesas para `now()`)
- Salvar preferência no banco via update na tabela `restaurants`

**Risco:** Baixo. Adição de coluna com default, sem alterar fluxos existentes.

---

## Ajuste 3 — Botão fixo na comanda (Menu.tsx)

O `ComandaBottomBar` já é `fixed bottom-0` com `z-50` e `Menu.tsx` já tem `pb-32`. O componente já funciona corretamente como especificado. Vou verificar se o conteúdo não é sobreposto e garantir o z-index adequado.

**Alterações:**
- Garantir que `ComandaBottomBar` tenha `z-[60]` (acima de outros elementos fixos)
- Confirmar `pb-32` no container principal (já existe na linha 983)
- Nenhuma mudança de comportamento

**Risco:** Zero. Apenas ajuste de z-index se necessário.

---

## Ajuste 4 — Notificações estilo iPhone (cascata compacta + expansão)

Substituir o sistema atual de popups empilhados em `RestaurantAdmin.tsx` (linhas 772-788) + `NewOrderNotification.tsx`.

**Alterações em `NewOrderNotification.tsx`** — reescrever completamente:
- **Estado fechado (pílula):** card compacto ~60px de altura: ícone tipo + "Mesa 5 — João" ou "🚚 Delivery — Maria" + valor. Clicável para expandir.
- **Estado aberto:** expande com itens, cliente, pagamento, botões "Aceitar" e "Parar Som"
- Cada notificação controla seu estado aberto/fechado individualmente
- Aceitar = chama `onView` (navega para o pedido) e remove da fila

**Alterações em `RestaurantAdmin.tsx`** (linhas 772-788):
- Renderizar máximo 3 pílulas empilhadas com deslocamento vertical (top: 16px, 26px, 36px em cascata)
- Se houver mais de 3, mostrar badge "+N" na última pílula visível
- Container: `fixed top-4 right-4 z-[100]` com `max-h-[70vh] overflow-y-auto` quando expandido
- Remover o padrão atual de empilhamento com `index * 220px`

**Risco:** Baixo. Apenas camada visual. A lógica de `notificationQueue`, `setNotificationQueue`, `handleViewOrder` e `handleDismiss` permanece idêntica.

---

## Ajuste 5 — Identificação clara do tipo de pedido

Já parcialmente implementado no `UnifiedOrdersTab.tsx` (linhas 232-244) e `NewOrderNotification.tsx` (linhas 133-139).

**Alterações:**
- `NewOrderNotification.tsx`: no título da pílula compacta, usar formato "🍽️ Mesa 5 — João" ou "🚚 Delivery — Maria" ou "📦 Retirada — Maria"
- `UnifiedOrdersTab.tsx`: prefixar o nome do cliente com o tipo — "🍽️ Mesa X — Nome" para locais, "🚚 Delivery — Nome" ou "📦 Retirada — Nome" para online
- `OrderDetailModal.tsx`: verificar e garantir que o cabeçalho mostra o tipo de pedido

**Risco:** Zero. Apenas mudanças de texto/label.

---

## Ajuste 6 — Som de notificação único e global

Atualmente cada `NewOrderNotification` cria seu próprio `AudioContext` e `setInterval`, causando duplicação de som.

**Alterações em `RestaurantAdmin.tsx`:**
- Criar um `audioContextRef` e `audioIntervalRef` globais no componente
- Função `startGlobalSound()`: se já tocando (`audioIntervalRef.current !== null`), retorna sem fazer nada. Caso contrário, cria AudioContext + setInterval com beep
- Função `stopGlobalSound()`: limpa interval, fecha AudioContext
- Quando `notificationQueue.length > 0` e som não está tocando → `startGlobalSound()`
- Quando `notificationQueue.length === 0` → `stopGlobalSound()` automaticamente
- Botão "Parar Som" chama `stopGlobalSound()` sem remover notificações
- Remover toda lógica de som do `NewOrderNotification.tsx` (será apenas visual)

**Risco:** Baixo. Centraliza controle de áudio sem alterar fluxo de pedidos.

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/InstallPWA.tsx` | Deletar |
| `src/App.tsx` | Remover import + uso de InstallPWA |
| `src/components/admin/NewOrderNotification.tsx` | Reescrever (pílula + expansão, sem som) |
| `src/pages/RestaurantAdmin.tsx` | Som global, cascata iPhone, prop showPrepTimer |
| `src/components/admin/UnifiedOrdersTab.tsx` | Prop showPrepTimer, labels de tipo |
| `src/components/admin/PDVTab.tsx` | Prop showPrepTimer |
| `src/components/admin/settings/CompanyDataSettings.tsx` | Toggle + botão zerar timer |
| `src/components/menu/ComandaBottomBar.tsx` | z-index ajuste |
| Migração SQL | Adicionar `show_prep_timer` na tabela `restaurants` |

Nenhum fluxo de aceitação, processamento ou status de pedidos será alterado.

