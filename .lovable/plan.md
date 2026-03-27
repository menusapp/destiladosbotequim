
Objetivo: parar imediatamente o consumo na Nuvem Fiscal e reverter apenas o bloco fiscal/sync (como você confirmou), sem mexer em PDV/cartão/estoque.

1) Contenção imediata (primeiro deploy)
- Reverter `src/components/admin/NotasFiscaisTab.tsx` para remover o auto-sync:
  - remover `useEffect` que chama `syncProcessingNotes()` quando há notas em `processing/pending`;
  - remover chamada automática de `syncProcessingNotes` no fluxo de carregamento.
- Ajustar ações da tabela:
  - notas com `nuvem_fiscal_ref` não vão mais disparar sync automático;
  - botão de “retentar/atualizar status” passa a não chamar sync em massa (só reemitir quando não existir `nuvem_fiscal_ref`).

2) Rollback do backend que está gerando consumo
- Reverter `supabase/functions/nuvem-fiscal-emit/index.ts`:
  - remover loop de 3 tentativas com `POST /nfce/{id}/sincronizar` + `GET /nfce/{id}` dentro da emissão;
  - emissão volta a fazer apenas o `POST /nfce`, salvar retorno e encerrar rápido.
- Desativar `supabase/functions/nuvem-fiscal-sync/index.ts` (rollback):
  - remover uso no front;
  - remover função implantada para impedir qualquer chamada acidental.

3) Correção de status travado (sem consumir novos eventos)
- Aplicar ajuste de dados para limpar “processing” que já têm chave/número válidos:
  - marcar como `authorized` quando houver `nfe_key` + `nfe_number` + sem erro técnico.
- Notas realmente sem resposta final permanecem pendentes para ação manual futura.

4) Correção de causa lógica (para não voltar o bug)
- Ajustar mapeamento de status para não priorizar `autorizacao.status="registrado"` sobre `status="autorizado"` do documento.
- Regra: status final da nota vem do status da NFC-e; evento de autorização não deve forçar “processing”.

5) Validação obrigatória após rollback
- Confirmar que abrir aba de notas não dispara mais ondas de execução da função de sync.
- Confirmar queda imediata de novos eventos consumidos.
- Confirmar que notas já com chave aparecem como autorizadas.
- Confirmar que nova emissão cria 1 evento de emissão (sem laço de sincronização interno).

Arquivos impactados
- `src/components/admin/NotasFiscaisTab.tsx`
- `supabase/functions/nuvem-fiscal-emit/index.ts`
- `supabase/functions/nuvem-fiscal-sync/index.ts` (remoção/desativação)
- ajuste pontual de dados em `order_fiscal_notes` (migração SQL de correção)

Detalhes técnicos
- Diagnóstico confirmado no código/logs:
  - loop de consumo veio do `useEffect` em `NotasFiscaisTab` + chamadas repetidas de `nuvem-fiscal-sync`;
  - havia também classificação incorreta para “processing” em notas já autorizadas por priorização de campo errado no mapeamento.
- Estratégia escolhida: rollback fiscal/sync para estado estável + saneamento de dados travados, sem alterar módulos de PDV/estoque.
