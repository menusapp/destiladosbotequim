/**
 * Formatadores compartilhados entre impressão real (printOrderWithQz)
 * e preview visual (buildReceiptPreview).
 */

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const local =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11)
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return local;
}

export function formatPaymentType(
  type: string | null | undefined,
  brand?: string | null
): string {
  if (!type) return "";
  const map: Record<string, string> = {
    cash: "Dinheiro",
    credit: "Cartão de Crédito",
    debit: "Cartão de Débito",
    pix: "PIX",
    pix_online: "PIX Online",
    card_online: "Cartão Online",
    credit_card_online: "Cartão Online",
    voucher: "Vale Refeição",
    meal_voucher: "Vale Refeição",
  };
  let base = map[type] || type;
  if (brand) {
    const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
    base = `${base} - ${brandName}`;
  }
  const onlineTypes = [
    "pix_online",
    "card_online",
    "credit_card_online",
    "online",
    "ifood_online",
  ];
  if (onlineTypes.includes(type.toLowerCase())) return base;
  return `${base.toUpperCase()} - PAG. NO LOCAL`;
}

export function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function formatDateTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDateTimeFull(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function shortOrderId(id: string): string {
  return "#" + id.slice(0, 8).toUpperCase();
}

/**
 * Rótulo amigável do pedido para exibição em cupons/impressões.
 * Usa o número sequencial diário (reseta à meia-noite) quando disponível,
 * caindo de volta para o id curto em registros legados.
 */
export function formatOrderLabel(order: {
  id: string;
  daily_order_number?: number | null;
}): string {
  const n = order.daily_order_number;
  if (n != null && Number.isFinite(Number(n))) {
    return `Pedido ${n}`;
  }
  return shortOrderId(order.id);
}

/**
 * Determina o rótulo de origem do pedido (mesmo critério do printOrder antigo).
 */
export function buildOriginLabel(order: {
  order_type: string | null;
  order_channel: string | null;
  delivery_type: string | null;
  tables: { table_number: number } | null;
}): string {
  const isLocal = order.order_type === "local";
  const isDelivery = order.delivery_type === "delivery";
  const isPickup = order.delivery_type === "pickup";

  if (isLocal) return `MESA ${order.tables?.table_number ?? "?"}`;
  if (order.order_type === "balcao" || order.order_channel === "totem") {
    return order.order_channel === "totem" ? "TOTEM - BALCAO" : "BALCAO";
  }
  if (isPickup) return "RETIRADA";
  if (isDelivery) return "ENTREGA";
  return "PEDIDO";
}
