
Objetivo: corrigir o bug do drawer do PDV para que, após limpar um cliente já carregado, o botão “Adicionar endereço” volte a aparecer corretamente quando o próximo celular/CPF não existir no CRM.

Diagnóstico
- A causa mais provável está em `src/components/admin/PDVTab.tsx`.
- Hoje a exibição do botão depende desta condição:
  - cliente não selecionado
  - dados preenchidos
  - `customerAddresses.length === 0`
  - `!selectedAddress`
- Quando um cliente já cadastrado é carregado, `customerAddresses` recebe os endereços desse cliente.
- Ao clicar em “Limpar”, o helper `clearCustomer()` limpa nome/CPF/telefone/endereço selecionado, mas não limpa `customerAddresses` nem o estado do formulário de endereço.
- Resultado: o próximo cliente inexistente entra com estado antigo “preso”, então a condição do botão falha até sair e voltar da aba.

Implementação
1. Ajustar o reset completo do cliente no PDV
- Atualizar `clearCustomer()` para também limpar:
  - `customerAddresses`
  - `showNewAddressForm`
  - campos temporários do novo endereço
  - qualquer estado visual relacionado ao endereço
- Fazer o mesmo em `clearForm()`, para evitar o mesmo bug em outros fluxos.

2. Fortalecer a troca entre cliente existente e cliente inexistente
- Nos handlers `handlePhoneAutoSearch` e `handleCpfAutoSearch`, quando:
  - o valor estiver incompleto/inválido, ou
  - a busca não encontrar cliente
- limpar explicitamente os estados herdados do cliente anterior:
  - `selectedCustomer`
  - `customerAddresses`
  - `selectedAddress`
- Preservar apenas o que o usuário digitou manualmente, para não apagar nome/celular/CPF que ele acabou de informar.

3. Deixar a regra do botão mais robusta
- Extrair a lógica para booleanos derivados, algo como:
  - `hasTypedCustomerData`
  - `isRegisteredCustomer`
  - `hasSavedAddresses`
  - `shouldShowAddAddressButton`
- Assim a UI deixa de depender de combinações frágeis espalhadas no JSX e passa a refletir o estado atual de forma previsível.

4. Revisar o bloco “Endereço de Entrega”
- Garantir estes comportamentos:
  - sem dados: mostrar mensagem “preencha celular ou CPF...”
  - cliente não cadastrado com dados digitados: mostrar botão “Adicionar endereço”
  - cliente cadastrado com endereços: listar endereços
  - cliente cadastrado sem endereços: mostrar “Nenhum endereço cadastrado” + botão para adicionar

Arquivo a alterar
- `src/components/admin/PDVTab.tsx`

Detalhes técnicos
- Não precisa migration nem mudança no backend.
- O problema é de estado local do React, não de banco.
- O foco será centralizar e normalizar o reset do bloco de cliente/endereço, evitando estado “vazando” entre uma busca e outra.

Validação que farei depois de implementar
1. Digitar celular existente → cliente e endereço carregam.
2. Clicar em limpar.
3. Digitar celular inexistente → botão “Adicionar endereço” aparece imediatamente.
4. Repetir o mesmo teste com CPF existente/inexistente.
5. Alternar várias vezes entre cliente existente e inexistente sem trocar de aba.
6. Criar novo endereço para cliente inexistente e confirmar que o pedido continua salvando cliente + endereço corretamente no CRM.

Resultado esperado
- O botão de adicionar endereço volta a aparecer no mesmo momento em que um celular/CPF inexistente é digitado, mesmo após ter limpado um cliente que já estava carregado anteriormente.
