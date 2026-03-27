

# Corrigir Download de PDF/XML das Notas Fiscais

## Diagnóstico

Os logs da edge function `nuvem-fiscal-download` mostram apenas "booted" — nenhum log de execução. Isso indica que:
1. A função pode estar falhando silenciosamente (crash antes do try/catch)
2. OU a API Nuvem Fiscal retorna erro (ex: `DfeNotFound` como no cancelamento), e a função repassa o status de erro, fazendo o SDK lançar `FunctionsHttpError`

Além disso, `supabase.functions.invoke()` pode não lidar bem com respostas binárias (PDF/XML). Quando o content-type não é JSON, o SDK pode tratar como erro.

## Correções

### 1. Edge function `nuvem-fiscal-download` — adicionar logs e sempre retornar 200

- Adicionar `console.log` antes da chamada à API para ver o `nuvem_fiscal_ref` e URL exata
- Quando a API retorna erro, logar o corpo do erro para debug
- Para respostas binárias bem-sucedidas, converter para **base64** e retornar como JSON com status 200 (garante compatibilidade com `supabase.functions.invoke`)

Estrutura da resposta de sucesso:
```json
{ "data": "<base64>", "content_type": "application/pdf", "filename": "nfce_xxx.pdf" }
```

### 2. Frontend `NotasFiscaisTab.tsx` — decodificar base64

- Receber o JSON com base64
- Converter para Blob usando `atob()` + `Uint8Array`
- Abrir PDF em nova aba / baixar XML como arquivo

### 3. Verificar se `nuvem_fiscal_ref` é válido

- Antes de chamar a API, fazer GET `/nfce/{id}` para verificar se o documento existe
- Se não existir, retornar mensagem clara ao invés de erro genérico

## Arquivos

- `supabase/functions/nuvem-fiscal-download/index.ts` (logs + retorno em base64 JSON)
- `src/components/admin/NotasFiscaisTab.tsx` (decodificar base64)

