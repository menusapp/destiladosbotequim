

## Plano: Visibilidade por Canal com Checkboxes Múltiplos

### Análise

A coluna `visibility_channels` já é um array de texto (`text[]`) na tabela `products`. O sistema já filtra com `channels.includes('all') || channels.includes('delivery')` etc. O problema é apenas que a UI usa um `Select` single-value, forçando escolher UM canal.

**Não precisa de migration.** A estrutura do banco já suporta múltiplos valores no array. Basta mudar a UI.

---

### 1. Alterar UI em `ProductsGrid.tsx`

Substituir o `Select` (linhas 813-821) por 3 checkboxes com o layout solicitado:
- Checkbox "Delivery" — controla presença de `'delivery'` no array
- Checkbox "Mesas" — controla presença de `'mesa'` no array  
- Checkbox "Totem" — só aparece se `kioskEnabled`
- Aviso em vermelho se nenhum canal selecionado
- Importar `Checkbox` de `@/components/ui/checkbox` e `AlertCircle` do lucide

Lógica do estado:
- Inicializar: se `visibility_channels` contém `'all'`, marcar todos os canais
- Salvar: array com os canais marcados (ex: `['delivery', 'mesa']`)
- Nunca mais salvar `'all'` — sempre valores explícitos

Reset do form (linha 649): setar `['delivery', 'mesa', 'totem']` em vez de `['all']`

### 2. Atualizar filtros nos cardápios (backward-compatible)

Manter o check `includes('all')` existente em `Menu.tsx`, `DeliveryMenu.tsx`, `Kiosk.tsx` para produtos antigos que ainda tenham `['all']`. Nenhuma mudança necessária nos filtros — já funcionam.

### 3. Validação ao salvar

No `handleSaveProduct`, validar que `visibilityChannels.length > 0` antes de salvar. Se vazio, exibir toast de erro.

---

### Arquivos modificados
- `src/components/admin/ProductsGrid.tsx` — substituir Select por Checkboxes, ajustar init/reset/save

