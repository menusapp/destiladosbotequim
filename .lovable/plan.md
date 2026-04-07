

# Adicionar configuração de número de cópias na impressão

## O que muda

### 1. Migration SQL
Adicionar coluna `print_copies` na tabela `printer_settings`:
```sql
ALTER TABLE printer_settings ADD COLUMN print_copies integer NOT NULL DEFAULT 1;
```

### 2. `PrintersSettings.tsx`
- Adicionar `printCopies: number` ao state `WebPrinterConfig` (default: 1)
- Adicionar um `Select` com opções 1, 2, 3, 4 vias entre os toggles de auto-print e o botão de teste
- Salvar `print_copies` no `upsert`
- Carregar `print_copies` no `loadWebConfig`

### 3. `printOrder.ts`
- Ao buscar `printer_settings`, ler também `print_copies`
- Após `printWindow.print()`, repetir o `print()` N-1 vezes com intervalo (ex: loop com `setTimeout` espaçado de 1s entre cada cópia)
- Alternativa mais robusta: duplicar o conteúdo HTML N vezes com `page-break-before` entre cada cópia, assim o `print()` único já gera todas as vias de uma vez — evita múltiplos diálogos de impressão

**Abordagem escolhida**: Duplicar o HTML com page-break. Assim uma única chamada `window.print()` imprime todas as vias sem precisar de múltiplos diálogos.

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar coluna `print_copies` |
| `src/components/admin/settings/PrintersSettings.tsx` | UI para escolher número de cópias |
| `src/lib/printOrder.ts` | Duplicar conteúdo HTML para N vias com page-break |

