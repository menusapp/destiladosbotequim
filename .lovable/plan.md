

## Plano: Botão "Desconectar" da integração Fiscal

### O que faz
Adicionar um botão "Desconectar" no `FiscalSettingsTab` que:
1. Reseta o `nuvem_fiscal_status` para `"pending"` na tabela `fiscal_configs`
2. Limpa os dados sensíveis (CSC, senha do certificado, caminho do certificado)
3. Remove o arquivo `.pfx` do storage bucket `fiscal-certificates`
4. Atualiza o estado local para refletir a desconexão

### Onde

**Modificar**: `src/components/admin/FiscalSettingsTab.tsx`

- Adicionar um botão vermelho "Desconectar" ao lado do alert de status (quando estiver "synced")
- Com confirmação via `AlertDialog` antes de executar ("Tem certeza? Isso vai remover o certificado e desconectar da Nuvem Fiscal.")
- Ao confirmar:
  - `supabase.storage.from('fiscal-certificates').remove([restaurantId + '/certificate.pfx'])`
  - `supabase.from('fiscal_configs').update({ nuvem_fiscal_status: 'pending', csc_id: '', csc_code: '', certificate_password: '', certificate_file_path: '' }).eq('restaurant_id', restaurantId)`
  - Resetar estado local e mostrar `toast.success("Desconectado da Nuvem Fiscal")`

### UI
- Botão com ícone `LogOut` e texto "Desconectar", posicionado no canto direito do alert de status "Sincronizada"
- Dialog de confirmação usando `AlertDialog` já disponível no projeto

