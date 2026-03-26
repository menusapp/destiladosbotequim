
Objetivo: corrigir de uma vez o “Validation failed”, impedir notas presas em “processing” e deixar a nota travada como recusada/rejeitada sem quebrar os fluxos já existentes.

1) Diagnóstico (confirmado nos logs)
- Erro atual real: `ValidationFailed` por CST inválido em:
  - `infNFe.det[0].imposto.PIS.PISOutr.CST = 07`
  - `infNFe.det[0].imposto.COFINS.COFINSOutr.CST = 07`
- A API aceita CSTs como 49, 50, 51...99 para esse bloco.
- Há inconsistência de status no código:
  - log verifica `rejeitado` (masculino)
  - mapeamento final só trata `rejeitada` (feminino)
  - isso pode deixar nota em `processing` quando deveria ir para erro/rejeição.
- Já existe nota travada em `processing` no banco (com chave), então precisamos tratar backlog também.

2) Correção “uma jogada só” (implementação)
Arquivo: `supabase/functions/nuvem-fiscal-emit/index.ts`

2.1 Corrigir imposto PIS/COFINS para valores válidos
- Remover hardcode `CST: "07"` em PIS/COFINS.
- Usar:
  - produto: `fiscal_pis_cst` / `fiscal_cofins_cst`
  - fallback seguro: `"49"` se vier vazio/inválido
- Aplicar a mesma regra aos extras.
- Manter ICMS no formato que já está aceito para Simples (`ICMSSN102` + `CSOSN: "400"`), sem alterar o resto fiscal desnecessariamente.

2.2 Normalizar mapeamento de status da Nuvem Fiscal
- Criar normalização robusta (lowercase) para mapear:
  - `autorizada`/`autorizado` -> `authorized`
  - `rejeitada`/`rejeitado`/`denegada`/`denegado` -> `error`
  - demais -> `processing`
- Se `apiResult.error` existir, forçar `status = error` e salvar motivo detalhado.

2.3 Salvar motivo completo da rejeição/validação no banco
- Continuar logando response completo.
- Montar `error_message` completo com:
  - `apiResult.error.message`
  - concatenação de `apiResult.error.errors[].message` (sem truncar)
  - `motivo_status` quando existir
- Assim o usuário vê o motivo real sem depender só dos logs.

2.4 Tirar nota travada de processing
- Na própria emissão, antes/ao final de tentativa com erro, atualizar a nota atual para `error`.
- Adicionar migração de saneamento (one-shot) para notas antigas:
  - `status='processing'` e antigas (ex.: > 30 min) -> `status='error'`
  - `error_message='Recusada automaticamente: processamento inconsistente/expirado'`
- Isso atende ao pedido de parar a nota que ficou processando.

3) Ajustes de interface para operação segura
Arquivo: `src/components/admin/NotasFiscaisTab.tsx`
- Exibir mensagem completa de erro (não só truncada) em área expandível/tooltip melhorado.
- Permitir “Retentar emissão” também quando status estiver `processing` (além de `pending`/`error`) para destravar operacionalmente.
- Onde hoje aparece “Erro”, ajustar rótulo para “Rejeitada/Erro” para refletir melhor o contexto fiscal.

4) Verificação de estabilidade (sem quebrar fluxo existente)
- Não mudar contrato de payload fora de impostos/status.
- Não alterar fluxo de sincronização da empresa/certificado.
- Não mexer em autenticação, pedidos, caixa ou módulos não fiscais.
- Manter endpoint e chamadas atuais (`nuvem-fiscal-emit` e UI existente).

5) Teste E2E obrigatório após deploy (checklist único)
- Salvar Configurações Fiscais.
- Sincronizar empresa.
- Emitir nota de um pedido concluído.
- Confirmar:
  - não retorna mais `Validation failed` por CST 07,
  - nota vai para `authorized` ou `error` com motivo completo,
  - nota antiga “processing” aparece como recusada/erro e sai do limbo,
  - botão de retentativa funciona para casos travados.

Detalhes técnicos (resumo)
- Principais causas do erro atual: CST inválido (07) + mapeamento inconsistente de rejeição.
- Arquivos impactados:
  - `supabase/functions/nuvem-fiscal-emit/index.ts` (principal)
  - `src/components/admin/NotasFiscaisTab.tsx` (visibilidade/retentativa)
  - `supabase/migrations/*` (saneamento de registros em processing)
- Risco: baixo-médio, concentrado no módulo fiscal; mitigado com fallback de CST válido e mapeamento defensivo de status.
