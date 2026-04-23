/**
 * dangerChecks — verificações contextuais para enriquecer confirmações.
 *
 * Estas funções consultam o estado atual antes de uma ação destrutiva e
 * retornam avisos legíveis para humanos (strings em pt-BR). Os avisos são
 * passados para `confirm({ warnings })` e exibidos em uma caixa amarela
 * dentro do diálogo.
 *
 * As funções NÃO bloqueiam por si só — quem decide se aborta ou não é
 * o componente chamador. A única exceção é `checkProductInActiveOrders`,
 * que retorna um indicador `blocked: true` para sinalizar bloqueio total
 * (produto em pedido em andamento não pode ser excluído).
 */
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready"] as const;

/**
 * Verifica se o caixa tem pedidos ainda em andamento que podem precisar
 * ser cobrados antes do fechamento. NÃO bloqueia — apenas avisa.
 */
export async function checkOpenOrdersBeforeCashClose(restaurantId: string): Promise<string[]> {
  const warnings: string[] = [];

  const { data: openOrders, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("restaurant_id", restaurantId)
    .in("status", ACTIVE_ORDER_STATUSES as unknown as string[]);

  if (error || !openOrders) return warnings;

  const count = openOrders.length;
  if (count > 0) {
    warnings.push(
      `Há ${count} pedido${count > 1 ? "s" : ""} ainda em andamento (pendente / em preparo / pronto).`,
    );
    warnings.push("Esses pedidos podem precisar ser cobrados antes do fechamento.");
  }

  return warnings;
}

/**
 * Soma o consumo não pago da mesa (contas com status diferente de "paid").
 * Retorna avisos se houver valor pendente.
 */
export async function checkUnpaidBeforeTableClear(tableId: string): Promise<string[]> {
  const warnings: string[] = [];

  const { data: bills, error } = await supabase
    .from("bills")
    .select("total_amount, status")
    .eq("table_id", tableId)
    .neq("status", "paid");

  if (error || !bills) return warnings;

  const totalUnpaid = bills.reduce((sum, b: any) => sum + Number(b.total_amount || 0), 0);
  if (totalUnpaid > 0) {
    warnings.push(
      `Esta mesa tem R$ ${totalUnpaid.toFixed(2).replace(".", ",")} em consumo não pago.`,
    );
  }

  // Também avisar sobre pedidos ativos na mesa
  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, status")
    .eq("table_id", tableId)
    .in("status", ACTIVE_ORDER_STATUSES as unknown as string[]);

  const activeCount = activeOrders?.length ?? 0;
  if (activeCount > 0) {
    warnings.push(
      `${activeCount} pedido${activeCount > 1 ? "s" : ""} ainda em andamento serão cancelados.`,
    );
  }

  return warnings;
}

/**
 * Retorna avisos extras se o pedido estiver sendo preparado pela cozinha.
 * Cancelar nesse momento pode gerar desperdício de insumos.
 */
export function checkOrderInPreparation(status: string | undefined | null): string[] {
  if (status === "preparing") {
    return [
      "Este pedido já está sendo preparado pela cozinha.",
      "Cancelar agora pode gerar desperdício de insumos.",
    ];
  }
  if (status === "ready") {
    return ["Este pedido já está pronto. Confirme se realmente precisa ser cancelado."];
  }
  return [];
}

/**
 * Bloqueia exclusão de produto que está em pedidos ativos.
 * Retorna { blocked: true, reason } quando NÃO deve ser excluído.
 */
export async function checkProductInActiveOrders(
  productId: string,
): Promise<{ blocked: boolean; reason?: string; activeCount?: number }> {
  // Buscamos itens do produto que pertencem a pedidos com status ativo.
  // Usar inner-join via "orders!inner(status)" garante que a filtragem
  // por status acontece no servidor, não no cliente.
  const { data, error } = await supabase
    .from("order_items")
    .select("id, orders!inner(status)")
    .eq("product_id", productId)
    .in("orders.status", ACTIVE_ORDER_STATUSES as unknown as string[]);

  if (error) {
    // Em caso de erro de consulta, NÃO bloqueamos — preferimos não impedir
    // a operação por uma falha de rede. A confirmação principal já protege.
    return { blocked: false };
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    return {
      blocked: true,
      activeCount: count,
      reason: `Este produto está em ${count} pedido${count > 1 ? "s" : ""} ativo${count > 1 ? "s" : ""}. Aguarde a finalização ou cancele os pedidos antes de excluir.`,
    };
  }
  return { blocked: false };
}
