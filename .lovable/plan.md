

# Reduzir tamanho dos switches de ativar/desativar

## Abordagem

Usar classes CSS inline para reduzir o tamanho dos switches nos 3 arquivos admin, sem alterar o componente `Switch` global (que é usado em outros lugares do sistema).

Aplicar `className="h-4 w-8 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4"` em cada `<Switch>` nos arquivos de CategoriesTab, ProductsTab e ComplementosTab. Isso reduz o switch de 24x44px para 16x32px — visivelmente mais discreto.

## Arquivos a alterar

| Arquivo | Switches |
|---|---|
| `src/components/admin/CategoriesTab.tsx` | 1 (linha ~426) |
| `src/components/admin/ProductsTab.tsx` | 1 (linha ~1607) |
| `src/components/admin/ComplementosTab.tsx` | 2 (linhas ~376 e ~410) |

## O que NÃO muda
- Componente `Switch` global (`src/components/ui/switch.tsx`)
- Nenhum fluxo de pedidos, estoque, fiscal ou integrações
- Nenhuma lógica de ativação/desativação — apenas visual

