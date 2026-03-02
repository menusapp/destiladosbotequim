

## Diagnóstico: Pagamentos em Produção em vez de Sandbox

### Causa Raiz Confirmada

As credenciais armazenadas no banco de dados sao de **PRODUCAO**, nao de teste:

- `mp_access_token`: `APP_USR-1390445...` (prefixo `APP_USR` = producao)
- `mp_public_key`: `APP_USR-4393506a...` (prefixo `APP_USR` = producao)

Credenciais de teste do Mercado Pago sempre comecam com `TEST-`:
- Access Token de teste: `TEST-1390445...`
- Public Key de teste: `TEST-4393506a...`

Os logs do webhook confirmam: `"live_mode":true` em todos os pagamentos recentes.

### Por que os pagamentos sao recusados

Com credenciais de producao, o Mercado Pago aplica validacao antifraude real. Cartoes de teste (como `5031 4332 1540 6351`) sao rejeitados imediatamente porque nao sao cartoes reais.

### Correcao Necessaria

**Nenhuma alteracao de codigo e necessaria.** O problema e exclusivamente de configuracao no banco de dados.

Voce precisa atualizar as credenciais na tabela `online_payment_config` para usar os valores de teste. No painel administrativo do seu app (Configuracoes > Pagamentos Online), substitua:

1. **Access Token**: Troque `APP_USR-1390445...` por `TEST-1390445596449726-030212-...-1505979876` (pegue o valor exato no painel do Mercado Pago em Credenciais de Teste)
2. **Public Key**: Troque `APP_USR-4393506a...` por `TEST-4393506a-...` (mesmo local)

Ambos os valores estao disponiveis em: **Mercado Pago > Suas Integracoes > [Seu App] > Credenciais de Teste**

Quer que eu atualize diretamente no banco de dados se voce me fornecer as credenciais TEST corretas?

