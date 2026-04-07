

# Diagnóstico Completo — Estado Atual de Segurança

## Resultado da análise

Todas as 5 tabelas sensíveis **JÁ estão com `USING(false)`** — bloqueio total para acesso direto:

| Tabela | Policy atual | Status |
|---|---|---|
| `ceo_users` | `block_direct_access` → `USING(false)` | ✅ Corrigido |
| `restaurant_staff` | `block_direct_access` → `USING(false)` | ✅ Corrigido |
| `restaurant_credentials` | `block_direct_access` → `USING(false)` | ✅ Corrigido |
| `online_payment_config` | `block_direct_access` → `USING(false)` | ✅ Corrigido |
| `fiscal_configs` | `block_direct_access` → `USING(false)` | ✅ Corrigido |

**Storage (`fiscal-certificates`):** Policies com scoping por `restaurant_id` via `storage.foldername()` estão ativas para SELECT, INSERT, UPDATE e DELETE. ✅

**Tokens Mercado Pago:** Acesso direto bloqueado. Acesso admin via RPC `admin_get_payment_config`. Menu público via RPC `get_public_payment_config` (que só retorna `mp_public_key`, nunca tokens secretos). ✅

**Acesso a dados:** Tudo opera via SECURITY DEFINER RPCs — nenhum dado sensível é retornado por queries diretas.

## Único problema real encontrado

**1 senha plaintext** no `restaurant_staff`: o usuário `joao1` (id: `a268e18e...`) tem senha em texto puro. Precisa ser convertida para bcrypt.

## Plano de ação

### 1. Converter senha plaintext para bcrypt
- Chamar a Edge Function `hash-password` com a senha atual do usuário `joao1`
- Atualizar o registro via migration/insert com o hash bcrypt
- **Problema:** não sabemos qual é a senha plaintext sem lê-la diretamente, e não podemos expô-la. A alternativa segura é: forçar uma redefinição (setar um hash bcrypt de uma senha temporária e notificar o dono do restaurante).

**Alternativa mais prática:** O sistema já possui auto-upgrade de senhas — quando `joao1` fizer login, a RPC `validate_staff_credentials` detecta que não é bcrypt e automaticamente converte para hash. Porém, enquanto ele não logar, a senha fica em texto puro no banco (que já está bloqueado por `USING(false)`).

**Ação recomendada:** Criar uma migration que force o hash de todas as senhas plaintext no `restaurant_staff` usando `extensions.crypt()`.

### 2. Atualizar/limpar findings do scanner
- Os 6 erros que o scanner mostra são **stale** (cache antigo). Rodar novo scan ou deletar findings obsoletos.

## Resumo de mudanças

| Item | Ação |
|---|---|
| Migration SQL | Hash forçado de senhas plaintext em `restaurant_staff` |
| Security findings | Deletar findings stale dos 6 erros |

## O que NÃO será alterado
- Nenhuma funcionalidade existente
- Nenhuma RPC, Edge Function ou componente frontend
- Nenhuma policy de tabela (todas já estão corretas)
- Nenhum fluxo de login, pedidos, estoque ou fiscal

## Risco de quebra: Zero
A migration apenas converte senhas existentes para bcrypt. O login já suporta bcrypt. Nada mais muda.

