

## Atualizar Secrets do Asaas

### Objetivo
Abrir os campos para voce inserir os valores corretos dos secrets `ASAAS_API_KEY` e `ASAAS_ENVIRONMENT`.

### O que sera feito

1. Solicitar atualizacao do secret **ASAAS_API_KEY** -- voce deve colar a chave de producao obtida em [asaas.com](https://www.asaas.com) > Configuracoes > Integracao > Chaves de API (formato: `$aact_...`)
2. Solicitar atualizacao do secret **ASAAS_ENVIRONMENT** -- valor: `production`
3. Redeployar a edge function `asaas-provision` para garantir que os novos valores sejam usados

### Secao tecnica

- Usar a ferramenta `add_secret` para solicitar os dois valores
- Executar deploy da edge function `asaas-provision` apos confirmacao
- Nenhuma alteracao de codigo necessaria

