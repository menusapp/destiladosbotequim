
Objetivo: eliminar o “processando infinito” na NFC-e sem quebrar emissão, estoque ou pagamentos.

1) Diagnóstico confirmado (com base no código + docs)
- A emissão da NFC-e é assíncrona: `POST /nfce` pode retornar `status: pendente/processando` antes do resultado final da SEFAZ.
- Hoje a função `supabase/functions/nuvem-fiscal-emit/index.ts` salva `processing`, mas não faz ciclo de consulta/sincronização depois disso.
- A tela `NotasFiscaisTab.tsx` também não faz atualização automática de status.
- Resultado: nota fica “processing” indefinidamente mesmo quando já há `nuvem_fiscal_ref` e até chave/número.

2) Correção principal (sem alterar regras fiscais já estabilizadas)
- Ajustar `nuvem-fiscal-emit` para, quando retorno inicial vier pendente/processando:
  - Consultar `GET /nfce/{id}`.
  - Se ainda pendente, chamar `POST /nfce/{id}/sincronizar`.
  - Consultar novamente `GET /nfce/{id}` e gravar status final quando disponível.
- Manter nota em `processing` apenas quando realmente ainda não houver resposta final, salvando mensagem de acompanhamento (última tentativa/retorno).

3) Evitar reemissão indevida e duplicidade
- Em `src/components/admin/NotasFiscaisTab.tsx`:
  - Para notas com `status=processing` e `nuvem_fiscal_ref` preenchido, botão deixa de “retentar emissão” e passa a “atualizar status”.
  - Esse botão chama sincronização/consulta (não cria nova emissão).
- Isso evita pular numeração e evita gerar nova NFC-e para o mesmo pedido enquanto a anterior está em processamento.

4) Sincronização automática de pendências (robustez)
- Criar função backend dedicada (ex.: `nuvem-fiscal-sync`) para atualizar notas em `processing` por `nuvem_fiscal_ref`.
- Na aba de notas, ao carregar e detectar pendências, chamar essa função e refazer `fetchNotes`.
- (Opcional seguro) polling leve só enquanto houver notas em processamento.

5) Validação de não regressão
- Caso real travado: nota `91e657b3-...` deve sair de `processing` após consulta/sincronização.
- Nova emissão dinheiro/cartão deve continuar funcionando como hoje.
- Nota rejeitada continua indo para `error` com motivo.
- Nota autorizada mantém chave, XML e PDF válidos.
- Fluxos de estoque/PDV não serão tocados nessa correção.

Detalhes técnicos (implementação)
- Arquivos:
  - `supabase/functions/nuvem-fiscal-emit/index.ts`
  - `supabase/functions/nuvem-fiscal-sync/index.ts` (novo)
  - `src/components/admin/NotasFiscaisTab.tsx`
- Endpoints da Nuvem Fiscal usados na reconciliação:
  - `GET /nfce/{id}`
  - `POST /nfce/{id}/sincronizar`
  - (já existentes para arquivos finais) `GET /nfce/{id}/pdf` e `GET /nfce/{id}/xml`
- Sem migração de banco obrigatória.
