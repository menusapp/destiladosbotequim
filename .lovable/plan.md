

# Plano — Excluir contas + Seletor de vias + Resposta sobre CEP

## 1. Ícone de excluir contas na aba Contas

### 1a. Criar RPC `admin_delete_staff`
Migration SQL:
```sql
CREATE OR REPLACE FUNCTION public.admin_delete_staff(p_staff_id uuid, p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM restaurant_staff
  WHERE id = p_staff_id AND restaurant_id = p_restaurant_id AND role != 'admin';
  RETURN FOUND;
END;
$$;
```

### 1b. `ContasTab.tsx`
- Importar `Trash2` do lucide-react
- Adicionar função `handleDelete` que chama `supabase.rpc("admin_delete_staff", { p_staff_id, p_restaurant_id })`
- Proteger: não permitir excluir conta admin nem a própria conta
- Pedir confirmação antes de excluir
- Adicionar botão `Trash2` ao lado dos botões Edit e Ativar/Desativar (apenas para contas não-admin)

## 2. Seletor de número de vias

O seletor **já existe** em `PrintersSettings.tsx` (linhas 229-241), dentro do card "Configurações de Impressão". Está logo abaixo dos toggles de auto-print. Se não está aparecendo, pode ser um problema de scroll ou cache. Não há alteração de código necessária.

## 3. Validação de CEP

A validação de regiões de entrega por CEP no sistema é baseada na API **ViaCEP** (`https://viacep.com.br/ws/{cep}/json/`). É uma API pública e gratuita brasileira que retorna dados de endereço a partir do CEP (logradouro, bairro, cidade, UF). Usada em 6 arquivos do projeto para autocompletar endereços e validar CEPs.

---

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar RPC `admin_delete_staff` |
| `src/components/admin/ContasTab.tsx` | Botão de excluir + lógica |

