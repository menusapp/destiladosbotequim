

## Plano: Sugestão Fiscal por IA nos Produtos

### O que será feito
Adicionar um botão "Sugerir com IA" na aba Fiscal do diálogo de edição de produto (em `ProductsTab.tsx` e `ProductsGrid.tsx`). Ao clicar, a IA recebe o nome do produto, descrição e UF do restaurante, e retorna os campos fiscais preenchidos automaticamente (NCM, CEST, CFOP, CSOSN, PIS, COFINS, etc.).

### Fluxo
1. Usuário abre a edição de um produto e vai na aba "Fiscal"
2. Clica no botão "Sugerir Tributação com IA"
3. Sistema envia nome, descrição e UF para uma Edge Function
4. A Edge Function usa Lovable AI para classificar o produto fiscalmente
5. Os campos são preenchidos automaticamente — o usuário pode revisar e ajustar antes de salvar

### Arquivos

1. **Nova Edge Function: `supabase/functions/fiscal-ai-suggest/index.ts`**
   - Recebe: `product_name`, `product_description`, `restaurant_id`
   - Busca a UF do restaurante na `fiscal_configs`
   - Chama Lovable AI com um prompt especializado em tributação brasileira para alimentos (Simples Nacional, NFC-e)
   - Usa tool calling para extrair saída estruturada com os campos: NCM, CEST, CFOP, CSOSN, Origem, PIS CST, COFINS CST, alíquotas
   - Retorna JSON com os valores sugeridos

2. **`src/components/admin/ProductsTab.tsx`**
   - Na aba "Fiscal" do dialog de edição, adicionar botão "Sugerir com IA" (ícone de varinha/sparkles)
   - Ao clicar, chama a Edge Function e preenche os campos fiscais com os valores retornados
   - Loading state enquanto processa

3. **`src/components/admin/ProductsGrid.tsx`**
   - Mesmo botão na aba Fiscal do dialog de edição/criação do ProductsGrid

### Detalhes técnicos
- Modelo: `google/gemini-3-flash-preview` (rápido e preciso para classificação)
- O prompt inclui contexto de Simples Nacional (CRT 1), operação NFC-e, e tabela NCM para alimentos/bebidas
- Tool calling garante resposta estruturada sem parsing manual
- UF é buscada para contextualizar CFOP e regras estaduais
- Os valores são apenas sugestões — o usuário sempre pode editar antes de salvar

