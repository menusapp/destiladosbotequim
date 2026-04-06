

# Fix: Mesa não libera após pagamento da última comanda

## Causa raiz

Na otimização anterior, três operações foram colocadas em `Promise.all` (linhas 352-361):
1. Fechar a comanda atual (`status: "closed"`)
2. Atualizar bills para `paid`
3. Buscar comandas ativas restantes

O problema: a operação 3 roda **ao mesmo tempo** que a operação 1. Quando a query de "comandas ativas" executa, a comanda atual ainda não foi fechada — então ela aparece como ativa, e o código conclui que ainda há comandas na mesa → não libera a mesa.

## Correção

Separar em dois passos:
1. **Primeiro** (em paralelo): fechar comanda + atualizar bills — seguro pois são tabelas diferentes
2. **Depois** (sequencial): buscar comandas ativas restantes e decidir se libera a mesa

Mudança apenas nas linhas 352-368 de `TableDetailDialog.tsx`. Nenhuma outra alteração.

## Código

```typescript
// Step 1: Close comanda + update bills in parallel (safe, different tables)
await Promise.all([
  comandaId
    ? supabase.from("comandas").update({ status: "closed", closed_at: now }).eq("id", comandaId)
    : Promise.resolve(),
  comandaId
    ? supabase.from("bills").update({ status: "paid", paid_at: now })
        .eq("comanda_id", comandaId).in("status", ["requested", "on_the_way"])
    : Promise.resolve(),
]);

// Step 2: AFTER closing, check remaining active comandas
const remainingRes = await supabase
  .from("comandas").select("id").eq("table_id", table!.id).eq("status", "active");

const remainingCmdas = remainingRes.data || [];
if (remainingCmdas.length === 0) {
  await supabase.from("tables").update({ is_occupied: false, occupied_by: null, occupied_at: null }).eq("id", table!.id);
} else {
  await supabase.from("tables").update({ occupied_by: `${remainingCmdas.length} cliente${remainingCmdas.length !== 1 ? "s" : ""}` }).eq("id", table!.id);
}
```

## Impacto
- Zero risco — restaura o comportamento original (sequencial) apenas para a verificação de mesa
- Mantém paralelização segura entre fechar comanda e atualizar bills

