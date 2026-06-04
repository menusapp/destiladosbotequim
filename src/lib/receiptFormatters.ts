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
      timeZone: "America/Sao_Paulo",
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

/**
 * Extrai o valor "Troco para: R$ X" das observações do pedido, se houver.
 * Retorna null quando o cliente não informou troco.
 */
export function parseChangeFor(notes: string | null | undefined): number | null {
  if (!notes) return null;
  // Aceita "Troco para: R$ X,YY" (cardápio/BR), "TROCO PARA R$ X,YY" (legado iFood)
  // e "Troco para: R$ X.YY" (iFood já persistido com toFixed → ponto como decimal).
  const m = notes.match(/Troco\s*para[:\s]+R?\$?\s*([\d.,]+)/i);
  if (!m) return null;
  const raw = m[1];
  let normalized: string;
  if (raw.includes(",")) {
    // BR: pontos são milhares, vírgula é decimal → "1.234,56" → 1234.56
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) || []).length === 1) {
    // US/JS: único ponto é decimal → "100.00" → 100.00
    normalized = raw;
  } else {
    // Múltiplos pontos sem vírgula → milhares → remove todos
    normalized = raw.replace(/\./g, "");
  }
  const num = parseFloat(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Extrai a observação do cliente das notas do pedido.
 * - Pedidos iFood/DD: notas são uma string com partes separadas por " | ".
 *   A observação aparece como "Obs.: <texto>".
 * - Pedidos do cardápio: notas costumam conter apenas o texto puro,
 *   eventualmente com "[Desconto:...]" ou "Troco para: R$ X" — esses são removidos.
 */
export function parseCustomerObservation(notes: string | null | undefined): string {
  if (!notes) return "";
  // Caso iFood/DD: extrair apenas o trecho "Obs.: ..."
  const m = notes.match(/Obs\.?:\s*([^|]+?)(?:\s*\||\s*$)/i);
  if (m) return m[1].trim();
  // Caso pedido com partes meta separadas por "|" mas sem "Obs.:" → não há observação
  if (/^Pedido (iFood|DD)/i.test(notes) || notes.includes(" | ")) return "";
  // Caso pedido normal do cardápio: limpar metadados e devolver
  return cleanReceiptNotes(notes);
}

/**
 * Remove o tag "[Desconto: ...]", a linha de "Troco para: R$ X" e
 * os metadados injetados em pedidos iFood/DD (separados por " | ").
 */
export function cleanReceiptNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  let s = notes;
  s = s.replace(/Pedido (iFood|DD) #[a-z0-9-]+/gi, "");
  s = s.replace(/AGENDADO:[^|]*/gi, "");
  s = s.replace(/RETIRADA NO LOCAL/gi, "");
  s = s.replace(/Taxa de entrega:[^|]*/gi, "");
  s = s.replace(/Taxa de servi[cç]o[^|]*/gi, "");
  s = s.replace(/Troco\s*para[:\s]+R?\$?\s*[\d.,]+/gi, "");
  s = s.replace(/Voucher[^|]*/gi, "");
  s = s.replace(/\[Desconto:.+?\]/g, "");
  s = s.replace(/Obs\.?:\s*/i, "");
  // Limpa pipes vazios resultantes
  s = s.split("|").map((p) => p.trim()).filter(Boolean).join(" | ");
  return s.replace(/\s{2,}/g, " ").trim();
}
