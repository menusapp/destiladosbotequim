

## Diagnóstico

O token OAuth está sendo emitido para o ambiente **sandbox** (`aud: https://api.sandbox.nuvemfiscal.com.br/`), mas a Edge Function está chamando a API de **produção** (`https://api.nuvemfiscal.com.br/empresas`). A API rejeita o token por mismatch de audience.

## Correção

Alterar a Edge Function `nuvem-fiscal-company` para usar as URLs do ambiente sandbox (compatível com as credenciais cadastradas):

1. **Token request**: Adicionar `audience: "https://api.sandbox.nuvemfiscal.com.br/"` nos parâmetros do OAuth
2. **API call**: Trocar `https://api.nuvemfiscal.com.br/empresas` por `https://api.sandbox.nuvemfiscal.com.br/empresas`

### Arquivo alterado
- `supabase/functions/nuvem-fiscal-company/index.ts` — 2 linhas

