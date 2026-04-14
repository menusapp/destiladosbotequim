

## Plano: Digitalizador de Cardápio por Foto com IA

### Resumo
O restaurante faz upload de uma foto do cardápio físico, seleciona o tipo de culinária, e a IA analisa a imagem retornando categorias, produtos, preços e variações. O usuário revisa, edita e confirma — os dados são inseridos nas tabelas `categories` e `products` existentes. Sem tocar em estoque/insumos.

### Fluxo

```text
[Frontend: MenuDigitizerDialog]
  → Upload foto + tipo de culinária
  → Chama Edge Function
      ↓
[Edge Function: digitize-menu]
  → Envia imagem (base64) ao Lovable AI (Gemini 2.5 Flash - visão)
  → Retorna JSON estruturado via tool calling
      ↓
[Frontend: Tela de Revisão]
  → Lista editável de categorias + produtos
  → Confirmar → insere tudo no banco
```

### O que será criado/editado

**1. Edge Function `digitize-menu`** (novo)
- Recebe imagem em base64 + tipo de culinária
- Prompt contextualizado (pizzaria → espera tamanhos; hamburgueria → combos, etc.)
- Usa Lovable AI Gateway com `google/gemini-2.5-flash` e tool calling para JSON estruturado
- Retorna: `{ categories: [{ name, products: [{ name, description, price, variations? }] }] }`

**2. Componente `MenuDigitizerDialog`** (novo)
- Dialog com 3 etapas:
  - **Etapa 1 — Tipo de culinária**: Pizzaria, Hamburgueria, Açaí/Sorveteria, Sushi, Cafeteria, Outros (campo livre)
  - **Etapa 2 — Upload**: Foto do cardápio (JPG/PNG), preview, converte para base64
  - **Etapa 3 — Revisão**: Lista editável de categorias e produtos extraídos. Nome, descrição e preço editáveis. Variações como sub-itens. Botão remover por item
- Ao confirmar: insere categorias e produtos no banco via Supabase SDK

**3. `CardapioTab.tsx`** (editar)
- Botão "Importar por Foto" no header
- Abre o dialog e recarrega produtos após importação

**4. `supabase/config.toml`** (editar)
- Adicionar `[functions.digitize-menu]` com `verify_jwt = false`

### Detalhes técnicos
- **Modelo**: `google/gemini-2.5-flash` — suporta visão, custo baixo (~1 crédito por foto)
- **Sem migração SQL** — usa tabelas existentes
- **Sem dependências novas**
- **LOVABLE_API_KEY** já está configurada no projeto

