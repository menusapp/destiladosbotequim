/**
 * Gera o texto puro do cupom térmico (mesmas regras do printOrderWithQz),
 * mas SEM bytes ESC/POS — para preview em tela usando fonte monoespaçada.
 *
 * Mantém:
 *  - Largura de 42 colunas (igual à impressão real)
 *  - Centralização, dividers, word-wrap, lineLR, labeled
 *  - Marcadores visuais para [NEGRITO], [GRANDE], [GIGANTE] (apenas indicativo)
 *  - Marcador de corte entre as duas vias
 */

import { supabase } from "@/integrations/supabase/client";
import {
  fetchOrderForPrinting,
  type OrderForPrinting,
} from "@/lib/fetchOrderForPrinting";

const LINE_WIDTH = 42;
const CUT_MARK =
  "\n" +
  "─".repeat(LINE_WIDTH) +
  "\n" +
  "✂  - - - - - - - -  CORTE  - - - - - - - -  ✂".padStart(
    Math.floor((LINE_WIDTH + 46) / 2)
  ) +
  "\n" +
  "─".repeat(LINE_WIDTH) +
  "\n\n";

// =============================================================
// Helpers (cópia em sincronia com printOrderWithQz.ts)
// =============================================================
function center(text: string, width = LINE_WIDTH): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const left = Math.max(0, Math.floor((width - t.length) / 2));
  return " ".repeat(left) + t + "\n";
}

function divider(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width) + "\n";
}

function wrap(text: string, width = LINE_WIDTH, indent = ""): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const max = Math.max(1, width - indent.length);
  const pushWord = (w: string) => {
    if (!current.length) {
      if (w.length > max) {
        for (let i = 0; i < w.length; i += max)
          lines.push(indent + w.slice(i, i + max));
      } else current = w;
    } else if (current.length + 1 + w.length <= max) {
      current += " " + w;
    } else {
      lines.push(indent + current);
      current = "";
      if (w.length > max) {
        for (let i = 0; i < w.length; i += max)
          lines.push(indent + w.slice(i, i + max));
      } else current = w;
    }
  };
  for (const w of words) pushWord(w);
  if (current.length) lines.push(indent + current);
  return lines;
}

function lineLR(left: string, right: string, width = LINE_WIDTH): string {
  const space = Math.max(1, width - right.length - 1);
  if (left.length <= space) {
    return left + " ".repeat(width - left.length - right.length) + right + "\n";
  }
  const wrapped = wrap(left, space);
  let out =
    wrapped[0] +
    " ".repeat(width - wrapped[0].length - right.length) +
    right +
    "\n";
  for (let i = 1; i < wrapped.length; i++) out += wrapped[i] + "\n";
  return out;
}

function labeled(label: string, value: string, width = LINE_WIDTH): string {
  const prefix = `${label} `;
  const indent = " ".repeat(prefix.length);
  const lines = wrap(value, width - prefix.length);
  if (!lines.length) return prefix + "\n";
  let out = prefix + lines[0] + "\n";
  for (let i = 1; i < lines.length; i++) out += indent + lines[i] + "\n";
  return out;
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDateTime(iso: string): string {
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

function shortOrderId(id: string): string {
  return "#" + id.slice(0, 8).toUpperCase();
}

async function fetchRestaurantName(orderId: string): Promise<string> {
  const { data } = await supabase
    .from("orders")
    .select("restaurant_id, restaurants:restaurant_id(name)")
    .eq("id", orderId)
    .single();
  const name = (data as any)?.restaurants?.name;
  return typeof name === "string" && name.length > 0 ? name : "Loja";
}

// =============================================================
// Vias (texto puro p/ preview)
// =============================================================
function buildCustomerPreview(order: OrderForPrinting, storeName: string): string {
  let out = "";

  // Cabeçalho
  for (const l of wrap(storeName.toUpperCase(), 21))
    out += center(l).replace("\n", "  [GRANDE]\n");

  out += divider("=");
  out += center("VIA DO CLIENTE  [NEGRITO]");
  out += divider("=");

  out += center(`PEDIDO ${shortOrderId(order.id)}  [GRANDE]`);
  out += "\n";

  out += labeled("Status: ", String(order.status).toUpperCase());
  out += labeled("Data:   ", formatDateTime(order.created_at));
  out += divider();

  out += labeled("Cliente:", order.customer_name || "-");
  if (order.customer_cpf) out += labeled("CPF:    ", order.customer_cpf);
  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    out += labeled(
      "Mesa:   ",
      tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`
    );
  }
  out += divider();

  out += center("ITENS DO PEDIDO  [NEGRITO]");
  out += divider();

  let total = 0;
  for (const item of order.order_items) {
    const subtotal = item.price_at_order * item.quantity;
    total += subtotal;

    const qty = `${item.quantity}x`.padEnd(3);
    const left = `${qty} ${item.products.name}`;
    out += lineLR(left, formatPrice(subtotal));

    if (item.quantity > 1) {
      out +=
        "    " +
        `(${item.quantity} x ${formatPrice(item.price_at_order)})` +
        "\n";
    }

    if (item.notes && item.notes.trim()) {
      const obsLines = wrap(`>> Obs: ${item.notes.trim()}`, LINE_WIDTH - 4);
      for (const l of obsLines) out += "    " + l + "  [NEGRITO]\n";
    }
    out += "\n";
  }

  out += divider();
  out += lineLR("Subtotal", formatPrice(total));
  out += divider("=");
  out += lineLR("TOTAL", formatPrice(total)) + "                                  [GRANDE+NEGRITO]\n".slice(0, 0);
  out += divider("=");

  out += "\n";
  out += center("Obrigado pela preferencia!  [NEGRITO]");
  out += center("Volte sempre :)");
  out += "\n\n\n";

  return out;
}

function buildKitchenPreview(order: OrderForPrinting): string {
  let out = "";

  out += center("VIA DA COZINHA  [GRANDE+NEGRITO]");
  out += divider("=");
  out += center(shortOrderId(order.id) + "  [GIGANTE]");
  out += divider("=");

  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    const mesaStr = tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`;
    out += "MESA: " + mesaStr + "  [GRANDE+NEGRITO]\n";
  }
  out += labeled("Cliente:", order.customer_name || "-");
  out += labeled("Hora:   ", formatDateTime(order.created_at));
  out += divider();

  out += center("ITENS A PREPARAR  [NEGRITO]");
  out += divider();

  for (const item of order.order_items) {
    for (const l of wrap(`${item.quantity}x ${item.products.name}`, 21))
      out += l + "  [GRANDE+NEGRITO]\n";

    if (item.notes && item.notes.trim()) {
      const obsLines = wrap(
        `>> OBS: ${item.notes.trim().toUpperCase()}`,
        LINE_WIDTH
      );
      for (const l of obsLines) out += l + "  [NEGRITO]\n";
    }
    out += divider("-");
  }

  out += "\n\n\n";
  return out;
}

export interface ReceiptPreviewResult {
  customer: string;
  kitchen: string;
  combined: string;
  storeName: string;
  orderId: string;
  lineWidth: number;
  cutMark: string;
}

export async function buildReceiptPreview(
  orderId: string
): Promise<ReceiptPreviewResult> {
  const [order, storeName] = await Promise.all([
    fetchOrderForPrinting(orderId),
    fetchRestaurantName(orderId),
  ]);
  const customer = buildCustomerPreview(order, storeName);
  const kitchen = buildKitchenPreview(order);
  return {
    customer,
    kitchen,
    combined: customer + CUT_MARK + kitchen + CUT_MARK,
    storeName,
    orderId,
    lineWidth: LINE_WIDTH,
    cutMark: CUT_MARK,
  };
}
