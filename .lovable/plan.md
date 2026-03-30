

# Plano — Misto PDV + Export XMLs + Categorias Sticky

## 3 correções

### 1. Campos do Misto não aparecem no PDV

**Problema:** O `scrollIntoView` com `setTimeout(100)` não funciona porque o container pai (`div` linha 409) tem `overflow-y-auto` com `max-h` — o `scrollIntoView` tenta scroll no viewport, não no container correto.

**Correção em `CreateOrderDrawer.tsx`:**
- Adicionar `useRef` ao container de scroll (div linha 409)
- Substituir o `setTimeout + scrollIntoView` por `requestAnimationFrame` com `containerRef.current.scrollTop = containerRef.current.scrollHeight`

### 2. Botão "Exportar XMLs" não funciona

**Problema:** Popover (calendário) dentro de Dialog — o Dialog captura focus/pointer-events e bloqueia cliques no Popover.

**Correção em `NotasFiscaisTab.tsx`:**
- Remover o Popover do export dialog
- Renderizar o Calendar **inline** direto dentro do Dialog (sem Popover wrapper)
- Manter mesma lógica de 2 cliques com `pendingExportDateRange`

### 3. Barra de categorias acima dos destaques + reduzir padding

**Problema:** A sticky bar de categorias está dentro de `CategoryProducts`, que renderiza DEPOIS de `FeaturedProducts` no `DeliveryMenu.tsx`. Por isso fica abaixo dos destaques.

**Correção:**
- Em `CategoryProducts.tsx`: extrair a nav bar para ser exportada separadamente OU adicionar uma prop `categories` ao componente pai
- Em `DeliveryMenu.tsx` (linhas 429-444): renderizar a barra de categorias ANTES do `FeaturedProducts`, passando as categorias disponíveis
- Reduzir padding dos botões de categoria: `px-4 py-1.5` → `px-3 py-1` e `text-sm` → `text-xs`

**Abordagem concreta:** Criar um componente `CategoryNav` separado (ou exportar de CategoryProducts) e renderizar em DeliveryMenu antes de FeaturedProducts. O CategoryProducts continua renderizando os produtos mas sem a nav duplicada (recebe `showNav={false}` ou remove a nav quando já existe externamente).

---

## Arquivos a editar

| Arquivo | Alteração |
|---------|----------|
| `CreateOrderDrawer.tsx` | Ref no container + scroll correto para misto |
| `NotasFiscaisTab.tsx` | Calendar inline no export dialog (sem Popover) |
| `CategoryProducts.tsx` | Extrair nav ou aceitar prop para ocultar |
| `DeliveryMenu.tsx` | Renderizar nav de categorias antes dos destaques |

Nenhuma funcionalidade existente será quebrada.

