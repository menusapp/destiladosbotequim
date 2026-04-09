

# Corrigir código PDV duplicado + validação de unicidade

## Problema
1. Ao duplicar produto, o código PDV é copiado, causando duplicidade (ex: Costela Burger e Picanha Burger ambos com "007")
2. Não há validação que impeça salvar um código PDV já existente

## Correções

### 1. Atualizar PDV do Picanha Burger no banco
- Usar insert tool para `UPDATE products SET pdv_code = '033' WHERE id = '356c5e96-0a43-4f2a-8710-d4ce7507e132'` (próximo código livre após o max atual de 032)

### 2. `ProductsGrid.tsx` — Limpar PDV ao duplicar
- Linha 304: trocar `setPdvCode((product as any).pdv_code || "")` para `setPdvCode("")`
- Assim o produto duplicado vem sem código PDV e o auto-generate preenche ao salvar

### 3. `ProductsGrid.tsx` — Validar unicidade antes de salvar
- No `handleSubmit`, após resolver o `finalPdvCode` (linha ~463-466), antes de inserir/atualizar:
  - Se `finalPdvCode` não é null, chamar `getAllUsedPdvCodes(restaurantId)` e verificar se o código já existe
  - Se editando, excluir o próprio produto da verificação
  - Se duplicado, mostrar `toast.error("Código PDV 'XXX' já está em uso")` e retornar sem salvar

### 4. `ComplementosTab.tsx` — Mesma validação para itens de complemento
- No `handleSaveItem`, antes de inserir/atualizar item com `pdv_code` manual:
  - Verificar unicidade via `getAllUsedPdvCodes`
  - Se editando, excluir o próprio item da checagem
  - Se duplicado, mostrar toast de erro e retornar

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Dados (insert tool) | Atualizar pdv_code do Picanha Burger para 033 |
| `ProductsGrid.tsx` | Limpar pdvCode ao duplicar + validação de unicidade no submit |
| `ComplementosTab.tsx` | Validação de unicidade no save de item |

## O que NÃO muda
- `pdvCodeGenerator.ts` — já funciona corretamente
- Fiscal, iFood, triggers de caixa, cardápio

