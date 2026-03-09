

## Plano: Habilitar Impressao Web (browser)

### Situacao Atual

A impressao ja funciona na web em varios lugares do sistema -- `OrdersTab`, `LocalOrdersTab`, `DeliveryOrdersTab`, `TableDetailView`, `BillsTab` e `OrderDetailModal` todos usam `window.open()` + `window.print()` para abrir o dialogo de impressao do navegador. Isso funciona perfeitamente com impressoras termicas instaladas no sistema.

O unico problema e a pagina de **Configuracoes de Impressoras** (`PrintersSettings.tsx`) que bloqueia completamente o acesso web com a mensagem "Disponivel apenas na versao Desktop".

### O que fazer

**Modificar `PrintersSettings.tsx`** para oferecer funcionalidade util na versao web:

1. **Remover o bloqueio total** -- ao inves de mostrar "apenas desktop", mostrar uma interface web funcional
2. **Secao "Impressao via Navegador"** -- explicar que na versao web, a impressao usa o dialogo nativo do navegador (`Ctrl+P`), que suporta impressoras termicas instaladas no sistema
3. **Configuracoes de papel** -- permitir escolher tamanho do papel (80mm/58mm) e salvar no banco (Supabase) para que o sistema use ao formatar as impressoes
4. **Botao "Testar Impressao"** -- usar `window.open()` + `window.print()` para gerar uma pagina de teste formatada para papel termico, igual ao padrao ja usado nos pedidos
5. **Toggle de auto-imprimir** -- na web nao e possivel imprimir silenciosamente, mas podemos abrir automaticamente a janela de impressao quando um pedido novo chegar (o usuario confirma no dialogo do navegador)
6. **Manter funcionalidade Electron** -- quando rodando no desktop, continua usando a API Electron como antes

Tambem vou criar uma tabela `printer_settings` no banco para salvar as preferencias de impressao (tamanho papel, auto-abrir dialogo) por restaurante, ja que na web nao temos o SQLite local.

### Arquivos

- **Editar:** `src/components/admin/settings/PrintersSettings.tsx` -- redesign com modo web
- **Criar:** migracao SQL para tabela `printer_settings`

