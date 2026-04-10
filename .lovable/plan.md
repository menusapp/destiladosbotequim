

## Plano: Corrigir Erros da Integração Mercado Pago Point

### Diagnóstico

Testei a edge function diretamente e encontrei os erros exatos:

1. **`create_order` retorna 400**: O payload enviado para `POST /v1/orders` contém campos inválidos (`title` e `total_amount`). O erro do MP é claro: `"additionalProperties '$.title', '$.total_amount' not allowed"`.

2. **`create_store` retorna 400**: O campo `location` é obrigatório, mas o código trata como opcional.

3. **Boa notícia**: O `list_terminals` funciona perfeitamente, e o terminal já tem `store_id: "81000130"` e `pos_id: 130124785` atribuídos pelo MP. Ou seja, não precisa criar store/POS — já existem.

Sobre credenciais: **não precisa de nada extra**. O token OAuth da conta MP conectada já está funcionando.

### Correções

**1. Corrigir payload do `create_order`** em `mercadopago-point/index.ts`

Remover `title` e `total_amount` do payload. O formato correto da Orders API v1:
```json
{
  "type": "point",
  "external_reference": "order_uuid",
  "description": "Pedido Totem",
  "transactions": {
    "payments": [{ "amount": "1.00" }]
  },
  "config": {
    "point": {
      "terminal_id": "DEVICE_ID",
      "print_on_terminal": "no_ticket"
    }
  }
}
```

**2. Logar o body de erro do MP** para facilitar debug futuro — hoje o log só mostra `status: error` sem o detalhe.

**3. Ajustar `create_store`** para exigir `location` no body.

**4. Ajustar o fluxo "Configurar" no admin** (`KioskSettings.tsx`): como o terminal já tem store e POS, detectar isso e pular direto para o teste de cobrança em vez de tentar criar store/POS novamente.

### Arquivos
- **Editar**: `supabase/functions/mercadopago-point/index.ts` — corrigir payload + logging
- **Editar**: `src/components/admin/settings/KioskSettings.tsx` — detectar store/POS existentes

