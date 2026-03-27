

# Correção Fiscal NFC-e + Gestão de Documentos

## Resumo

O problema das rejeições vem de 3 pontos: (1) ICMS sempre usando `ICMSSN102` com CSOSN `400` em vez do CSOSN real do produto, (2) PIS/COFINS usando `PISOutr/COFINSOutr` em vez de `PISNT/COFINSNT`, (3) potencial falta do nó `cartao` em pagamentos de cartão. Além disso, a resposta da API não está sendo tratada corretamente - o campo `chave` da raiz do objeto `Dfe` é a chave de acesso real, mas `autorizacao.status` pode ser `registrado` (que significa sucesso na SEFAZ), não `autorizado`.

## O que será feito

### 1. Migração de banco - adicionar colunas `url_consulta` e `url_qrcode`
- Adicionar `url_consulta TEXT` e `url_qrcode TEXT` à tabela `order_fiscal_notes`
- Permitir armazenar os links oficiais retornados pela API

### 2. Refatorar `nuvem-fiscal-emit/index.ts` - Impostos

**ICMS dinâmico baseado no CSOSN do produto:**
- Se CSOSN `102` ou `103` -> nó `ICMSSN102` com `{ orig, CSOSN }`
- Se CSOSN `500` -> nó `ICMSSN500` com `{ orig, CSOSN: "500" }`
- Fallback para `ICMSSN102` com CSOSN `102` se campo vazio

**PIS/COFINS corrigido:**
- Trocar de `PISOutr`/`COFINSOutr` para `PISNT`/`COFINSNT` com CST `"07"`
- Isso elimina rejeição por grupo de imposto incorreto

### 3. Refatorar `nuvem-fiscal-emit/index.ts` - Pagamentos

O mapeamento de cartão já existe e parece correto (campo `card` com `tpIntegra` e `tBand`). Vou:
- Corrigir o mapa de bandeiras: `elo` deve ser `"06"` (não `"04"`)
- Adicionar `sorocred: "04"` e `hipercard: "05"`
- Garantir que `tpIntegra` seja enviado como `"2"` (string, não número)

### 4. Corrigir mapeamento de status da resposta

Conforme o swagger, o `Dfe.status` retorna: `pendente`, `autorizado`, `rejeitado`, `denegado`, `cancelado`, `erro`. E `autorizacao.status` retorna: `pendente`, `registrado`, `rejeitado`, `erro`.

O bug atual: `autorizacao.status = "registrado"` significa que o protocolo foi registrado na SEFAZ (nota autorizada), mas o código não reconhece isso. Corrigir:
- `Dfe.status === "autorizado"` -> `authorized`
- `autorizacao.status === "registrado"` -> `authorized` (quando `Dfe.status` é `autorizado`)
- Salvar `Dfe.chave` como a chave de acesso de 44 dígitos

### 5. Criar edge function `nuvem-fiscal-cancel`

Nova função para cancelamento via `POST /nfce/{id}/cancelamento`:
```
Body: { "justificativa": "..." }
```
- Recebe `nuvem_fiscal_ref` (o id da nota na API) e `justificativa`
- Chama a API e atualiza status para `canceled` no banco

### 6. Criar edge function `nuvem-fiscal-download`

Nova função proxy para download de PDF/XML autenticado:
- Recebe `nuvem_fiscal_ref` e `type` (pdf ou xml)
- Chama `GET /nfce/{id}/pdf` ou `GET /nfce/{id}/xml` com token OAuth
- Retorna o arquivo ao cliente
- Isso resolve o problema de que as URLs salvas precisam de autenticação

### 7. Atualizar `NotasFiscaisTab.tsx` - Botões de ação

Para notas autorizadas:
- **PDF**: Chamar `nuvem-fiscal-download` com type=pdf e abrir em nova aba
- **XML**: Chamar `nuvem-fiscal-download` com type=xml e baixar
- **Cancelar**: Modal com campo de justificativa (min 15 chars), chamar `nuvem-fiscal-cancel`

Para notas canceladas: desabilitar botões de download

### 8. Atualizar `FiscalNoteDetailSheet.tsx`

- Exibir chave de acesso formatada (grupos de 4 dígitos)
- Botão "Consultar na SEFAZ" usando `url_consulta` se disponível
- Exibir QR Code se `url_qrcode` disponível

## Arquivos impactados

- `supabase/functions/nuvem-fiscal-emit/index.ts` (corrigir impostos, pagamentos, status)
- `supabase/functions/nuvem-fiscal-cancel/index.ts` (novo)
- `supabase/functions/nuvem-fiscal-download/index.ts` (novo)
- `src/components/admin/NotasFiscaisTab.tsx` (botões de ação)
- `src/components/admin/FiscalNoteDetailSheet.tsx` (exibição melhorada)
- Migração SQL (colunas `url_consulta`, `url_qrcode`)

## Detalhes técnicos

### Mapeamento ICMS (switch no emit)
```
CSOSN 102/103 -> { ICMS: { ICMSSN102: { orig, CSOSN: "102" } } }
CSOSN 500     -> { ICMS: { ICMSSN500: { orig, CSOSN: "500" } } }
default       -> { ICMS: { ICMSSN102: { orig: 0, CSOSN: "102" } } }
```

### PIS/COFINS fixo
```
PIS:    { PISNT:    { CST: "07" } }
COFINS: { COFINSNT: { CST: "07" } }
```

### Bandeiras corrigidas
```
visa: "01", mastercard: "02", amex: "03", sorocred: "04",
hipercard: "05", elo: "06", diners: "07", outros: "99"
```

### Resposta Dfe (captura)
```
chave_acesso = apiResult.chave  (44 dígitos)
numero       = apiResult.numero
status       = apiResult.status (autorizado/rejeitado/etc)
```

