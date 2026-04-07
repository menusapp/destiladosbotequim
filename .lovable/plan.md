

# Ativação, Desativação e Programação de Produtos em Destaque

## O que será feito

Cada produto em destaque terá:
1. **Toggle ativo/inativo** — desativar temporariamente sem remover dos destaques
2. **Programação por dia e horário** — definir em quais dias da semana e horários o produto aparece como destaque (ex: só segunda a sexta das 11h às 15h)

## Mudanças no banco de dados

Adicionar 2 colunas na tabela `products`:

```sql
ALTER TABLE products ADD COLUMN featured_active boolean DEFAULT true;
ALTER TABLE products ADD COLUMN featured_schedule jsonb DEFAULT null;
```

`featured_schedule` armazena um array como:
```json
[
  { "day": 0, "start": "11:00", "end": "15:00" },
  { "day": 1, "start": "11:00", "end": "15:00" },
  ...
]
```
Quando `null` = sempre visível (sem restrição de horário). Dia 0 = domingo, 6 = sábado.

## Mudanças no admin (DestaquesTab.tsx)

Para cada produto em destaque na lista, adicionar:
- **Switch ativo/inativo** ao lado do nome — toggle rápido
- **Botão "Programar"** que abre um dialog com:
  - Checkboxes para cada dia da semana (Dom-Sáb)
  - Campos de horário início/fim para cada dia selecionado
  - Opção "Sempre visível" (limpa a programação)

Badge visual indicando status: "Ativo", "Inativo", "Programado" com cores distintas.

## Mudanças nos cardápios (Menu.tsx, DeliveryMenu.tsx, KioskMenu.tsx)

Criar função utilitária `isFeaturedVisible(product)` que verifica:
1. `is_featured === true`
2. `featured_active === true` (ou null, para retrocompatibilidade)
3. Se `featured_schedule` existe, verificar se dia/hora atual está dentro da programação

Aplicar essa função nos filtros de featured products em todos os cardápios, substituindo o simples `p.is_featured`.

## Arquivos impactados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar `featured_active` e `featured_schedule` |
| `src/components/admin/DestaquesTab.tsx` | Toggle ativo, dialog de programação, badges |
| `src/lib/featuredUtils.ts` (novo) | Função `isFeaturedVisible()` |
| `src/pages/Menu.tsx` | Usar `isFeaturedVisible` no filtro |
| `src/pages/DeliveryMenu.tsx` | Usar `isFeaturedVisible` no filtro |
| `src/components/kiosk/KioskMenu.tsx` | Usar `isFeaturedVisible` no filtro |
| `src/types/menu.ts` | Adicionar `featured_active`, `featured_schedule` ao tipo |

## Retrocompatibilidade
- `featured_active` default `true` — produtos existentes continuam visíveis
- `featured_schedule` default `null` — sem programação = sempre visível
- Zero impacto em produtos que não são destaque

