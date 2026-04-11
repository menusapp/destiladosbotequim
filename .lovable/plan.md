
Objetivo

Corrigir só a criação/salvamento/uso do `external_pos_id` do PIX, sem tocar em cartão, Orders API ou qualquer fluxo de cobrança de cartão.

O que encontrei

- O PIX lê `mp_pos_id` somente de `online_payment_config` em `supabase/functions/mercadopago-point/index.ts`.
- Os logs já mostram o problema real: `mp_user_id` existe e `mp_pos_id` está `null`, então o QR nem chega a ser enviado.
- O painel do Totem está desalinhado com isso: depois de `create_pos`, ele salva no terminal só `mp_external_store_id`/`mp_external_pos_id` (IDs internos do MP), enquanto o card visual usa `mp_store_id`/`mp_pos_id`.
- Ao selecionar terminal, `KioskSettings` também grava `device.store_id`/`device.pos_id`, mas isso não deve ser tratado como `external_pos_id` canônico do PIX.
- Resultado: o backend do PIX olha um lugar, o painel mostra outro, e o POS pode existir no MP sem ficar persistido do jeito que o PIX precisa.

Plano de correção

1. `supabase/functions/mercadopago-point/index.ts`
- Manter cartão 100% intacto.
- Em `create_pos`, tratar `body.external_id` como o único valor válido para PIX.
- Salvar esse valor em `online_payment_config.mp_pos_id` com persistência garantida.
- Adicionar logs estruturados com:
  - `restaurant_id`
  - `mp_user_id`
  - `store_id`
  - `terminal_id` (se enviado)
  - `pos_created`
  - `external_pos_id`
  - resultado do save
- Em `create_pix_qr`, manter o endpoint QR atual e só reforçar validação/log:
  - se `mp_user_id` vazio -> erro claro
  - se `mp_pos_id` vazio -> erro claro
  - logar `mp_user_id`, `mp_pos_id`, `terminal_id`

2. `src/components/admin/settings/KioskSettings.tsx`
- No fluxo “Criar Loja e Caixa”, ao criar o POS:
  - persistir no terminal os campos corretos:
    - `mp_store_id = external_store_id`
    - `mp_pos_id = external_pos_id`
    - `mp_external_store_id = id interno da store`
    - `mp_external_pos_id = id interno do POS`
- Não usar `device.pos_id`/`device.store_id` como verdade do PIX.
- Recarregar os dados após a criação para confirmar o valor salvo antes de liberar PIX.

3. Status claro no painel
- Exibir explicitamente:
  - Store criada
  - POS criado
  - External POS ID salvo
  - Terminal vinculado
- Se `mp_pos_id` estiver `null`, bloquear o PIX nessa área e mostrar erro claro.
- O valor mostrado como “External POS ID salvo” deve vir da fonte canônica usada pelo PIX, não de nome/ID interno.

4. Backend seguro para o painel
- Se o painel hoje não recebe `mp_pos_id` por RPC, criar/ajustar uma função admin segura para expor esse campo sem abrir acesso direto à tabela sensível.
- Não mudar o fluxo de cartão e não usar fallback.

Detalhes técnicos

- Fonte canônica do PIX: `online_payment_config.mp_pos_id`
- Espelho para vínculo visual do terminal: `point_terminals.mp_pos_id`
- `mp_pos_name`, nome do POS, `id` interno do MP e `device.pos_id` não podem substituir o `external_pos_id`
- Sem alteração em `create_order`, sem alteração em Orders API, sem alteração em crédito/débito/voucher

Arquivos previstos

- `supabase/functions/mercadopago-point/index.ts`
- `src/components/admin/settings/KioskSettings.tsx`
- possivelmente 1 migration pequena para ajustar/expor RPC admin do `mp_pos_id`

Validação final

- Confirmar em log que o PIX sai com `mp_user_id` e `mp_pos_id` preenchidos
- Confirmar no painel os 4 estados visíveis
- Testar PIX fim a fim
- Revalidar que cartão continua exatamente como está
