

## Plano: Importar Cardápio do iFood

### Contexto
O iFood possui uma API de catálogo (`/merchant-api/catalog/v2.0/merchants/{merchantId}/catalogs`) que permite buscar os produtos cadastrados na loja. Atualmente o sistema já tem integração com iFood para **pedidos** (polling), mas não utiliza a API de catálogo.

### O que será feito
Criar um botão "Importar do iFood" na aba de Cardápio que busca todos os produtos do catálogo iFood do restaurante e os importa como categorias e produtos na base local.

### Fluxo

1. Usuário clica em "Importar do iFood" (botão ao lado do digitalizador existente)
2. Sistema verifica se o iFood está conectado (via `ifood_config`)
3. Se conectado, chama uma nova Edge Function `ifood-catalog` que:
   - Usa o `access_token` do iFood para buscar o catálogo via API
   - Retorna categorias e produtos com nomes, descrições e preços
4. Exibe preview dos itens encontrados (reutilizando o padrão do digitalizador)
5. Usuário confirma e os produtos são criados no banco com códigos PDV únicos

### Arquivos

1. **Nova Edge Function: `supabase/functions/ifood-catalog/index.ts`**
   - Recebe `restaurant_id`
   - Busca `access_token` e `merchant_id` da `ifood_config`
   - Chama `GET /merchant-api/catalog/v2.0/merchants/{merchantId}/catalogs` para listar catálogos
   - Para cada catálogo, busca os itens via `/catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories`
   - Retorna as categorias e produtos formatados

2. **`src/components/admin/ProductsGrid.tsx`**
   - Adicionar botão "Importar do iFood" ao lado do botão de digitalizar
   - Só aparece se o restaurante tiver iFood configurado e conectado

3. **`src/components/admin/ImportIfoodDialog.tsx`** (novo)
   - Dialog que mostra loading enquanto busca o catálogo
   - Exibe preview das categorias/produtos encontrados com checkboxes
   - Permite editar preços antes de importar
   - Ao confirmar, cria categorias e produtos no banco com PDV únicos

4. **`supabase/config.toml`**
   - Adicionar `[functions.ifood-catalog]` com `verify_jwt = false`

### Detalhes técnicos
- A API do iFood usa endpoints `merchant-api.ifood.com.br/catalog/v2.0/`
- O token de acesso já existe na tabela `ifood_config` e é renovado pelo `ifood-refresh-token`
- Produtos importados respeitam a regra de PDV único (sem duplicatas)
- Categorias existentes com mesmo nome serão reutilizadas (sem duplicar)
- Respeita a regra de não criar produtos com o restaurante aberto

