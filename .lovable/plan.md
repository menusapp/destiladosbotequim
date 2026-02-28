

## Diagnóstico

O problema é claro: o login do painel do restaurante (Landing.tsx) usa a RPC `validate_restaurant_credentials` e salva o `restaurant_id` no `localStorage`, mas **não cria uma sessão de autenticação Supabase**. O usuário está efetivamente como `anon` (anônimo), não como `authenticated`.

As políticas do bucket `fiscal-certificates` exigem role `authenticated`, por isso o upload retorna 400 RLS violation.

## Plano de Correção

### 1. Migração SQL - Alterar policies do bucket para `anon`

Dropar as 4 policies atuais (que usam `TO authenticated`) e recriá-las com `TO anon, authenticated`:

```sql
DROP POLICY IF EXISTS "fiscal_insert" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_select" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_update" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_delete" ON storage.objects;

CREATE POLICY "fiscal_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'fiscal-certificates');
CREATE POLICY "fiscal_select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'fiscal-certificates');
CREATE POLICY "fiscal_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'fiscal-certificates');
CREATE POLICY "fiscal_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'fiscal-certificates');
```

### Escopo
- 1 migração SQL (drop + recreate 4 storage policies)
- Zero alterações de código frontend

### Nota de Segurança
Isso permite que qualquer requisição com a anon key faça upload neste bucket. Como o bucket é privado e o path usa `restaurant_id`, o risco é baixo, mas futuramente convém migrar o login do restaurante para sessão autenticada real.

