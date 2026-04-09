/**
 * Shared helper to derive a human-readable order origin label and category.
 * Used by CashMovementDetailSheet, OrderDetailModal, etc.
 */

interface OrderForOrigin {
  order_type?: string | null;
  delivery_type?: string | null;
  order_channel?: string | null;
  pdv_source?: boolean | null;
  dd_source?: boolean | null;
  ifood_source?: boolean | null;
  table_id?: string | null;
  tables?: { table_number?: number; table_name?: string | null } | null;
}

export function getOrderOriginLabel(order: OrderForOrigin): string {
  // External integrations first
  if (order.ifood_source) return "iFood";
  if (order.dd_source) return "Delivery Direto";
  if (order.order_channel === "totem") return "Totem";

  // PDV-created orders
  if (order.pdv_source) {
    if (order.order_type === "local" && order.table_id) {
      const tableName = order.tables?.table_name || `Mesa ${order.tables?.table_number || "?"}`;
      return `${tableName} via PDV`;
    }
    if (order.delivery_type === "pickup") return "PDV - Retirada";
    if (order.delivery_type === "takeaway") return "PDV - Viagem";
    return "PDV - Entrega";
  }

  // Non-PDV (digital menu / QR code)
  if (order.order_type === "local" && order.table_id) {
    const tableName = order.tables?.table_name || `Mesa ${order.tables?.table_number || "?"}`;
    return `${tableName} via QR Code`;
  }

  // Digital delivery menu
  if (order.delivery_type === "pickup") return "Retirada - Cardápio Digital";
  if (order.delivery_type === "takeaway") return "Viagem - Cardápio Digital";
  return "Entrega - Cardápio Digital";
}

export function getOrderCategoryLabel(order: OrderForOrigin): string {
  if (order.order_type === "local") return "Mesa";
  if (order.delivery_type === "pickup") return "Retirada";
  if (order.delivery_type === "takeaway") return "Viagem";
  return "Delivery";
}
