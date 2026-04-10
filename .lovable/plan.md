

## Plano: Trocar modo do terminal para PDV automaticamente

### Problema
A maquininha está em modo `STANDALONE` — ela só aceita digitação manual de valor. Para receber cobranças via API, precisa estar em modo `PDV` (integrado).

### Solução

**1. Adicionar action `change_operating_mode` na edge function `mercadopago-point`**

Novo action que chama:
```
PATCH /point/integration-api/devices/{device_id}
Body: { "operating_mode": "PDV" }
```

Isso muda o terminal para modo integrado automaticamente.

**2. Atualizar KioskSettings — botão "Ativar modo integrado"**

Após buscar o terminal e detectar `operating_mode: STANDALONE`:
- Mostrar aviso: "A maquininha está em modo manual. Para receber cobranças do sistema, ative o modo integrado."
- Botão "Ativar modo integrado" que chama a nova action
- Após sucesso, liberar o botão "Testar"
- Se já estiver em modo `PDV`, mostrar status verde e liberar teste direto

**3. No fluxo de "Configurar", incluir a troca de modo automaticamente**

Quando o admin clica "Configurar", o sistema já faz: criar Store → criar POS → **trocar modo para PDV**. Tudo automático.

### Arquivos
- **Editar**: `supabase/functions/mercadopago-point/index.ts` — nova action `change_operating_mode`
- **Editar**: `src/components/admin/settings/KioskSettings.tsx` — detectar modo + botão ativar

