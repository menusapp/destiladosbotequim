

## Plano: Corrigir nota "inválida" e salvar dados completos da emissão

### Diagnóstico
1. A edge function `nuvem-fiscal-emit` não salva `nuvem_fiscal_ref` (ID da Nuvem Fiscal), `xml_url` e `pdf_url` da resposta da API — todos estão NULL no banco
2. Sem esses dados, não há como validar ou consultar a nota externamente
3. O mapeamento de pagamento quebrou após a adição de bandeiras de cartão — "Crédito - Visa" cai no fallback tPag "99" ao invés de "03" com `tBand`
4. Para pagamentos com cartão (tPag 03/04), a SEFAZ exige o campo `tBand` (bandeira do cartão) — que nunca é enviado

### Correções (arquivo único: `supabase/functions/nuvem-fiscal-emit/index.ts`)

**1. Salvar todos os campos da resposta da Nuvem Fiscal**
- Após emissão bem-sucedida, extrair e salvar:
  - `apiResult.id` → `nuvem_fiscal_ref`
  - `apiResult.autorizacao?.xml` ou URL do XML → `xml_url`  
  - PDF URL construída ou retornada → `pdf_url`
  - `apiResult.chave` → `nfe_key` (já faz)
  - `apiResult.numero` → `nfe_number` (já faz)

**2. Corrigir `mapPaymentMethod` para suportar formato com bandeira**
- Detectar padrões como "Crédito - Visa", "Débito - Mastercard" usando `startsWith`/`includes`
- Mapear para o tPag correto (03 crédito, 04 débito)
- Adicionar campo `tBand` com código da bandeira:
  - Visa → "01", Mastercard → "02", Amex → "03", Elo → "04", Hipercard → "06", Diners → "07"
- Manter compatibilidade com formatos antigos ("cash", "pix", etc.)

**3. Melhorar o mapeamento de status**
- Verificar se o status real está em `apiResult.autorizacao.status` além do top-level
- Se existir `protocolo` na resposta, usar como confirmação adicional de autorização

### Arquivos impactados
- `supabase/functions/nuvem-fiscal-emit/index.ts` — único arquivo alterado

### Sem impacto em
- Fluxo de sincronização de empresa/certificado
- UI de notas fiscais (já tem colunas para xml_url, pdf_url, nuvem_fiscal_ref)
- Pedidos, estoque, caixa

