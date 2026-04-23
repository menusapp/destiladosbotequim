/**
 * Gera o texto puro do cupom térmico (mesmas regras do printOrderWithQz),
 * mas SEM bytes ESC/POS — para preview em tela usando fonte monoespaçada.
 *
 * Suporta DUAS larguras:
 *  - 80mm → 42 colunas (padrão da impressão real em printOrderWithQz)
 *  - 58mm → 32 colunas (impressoras compactas)
 *
 * Mantém:
 *  - Centralização, dividers, word-wrap, lineLR, labeled
 *  - Marcadores visuais [NEGRITO]/[GRANDE]/[GIGANTE] — apenas indicativo,
 *    NÃO saem no papel real (são interpretados como bytes ESC/POS).
 *  - Marcador de corte entre as duas vias.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  fetchOrderForPrinting,
  type OrderForPrinting,
} from "@/lib/fetchOrderForPrinting";

export type ReceiptWidth = "58mm" | "80mm";

export const WIDTH_COLUMNS: Record<ReceiptWidth, number> = {
  "58mm": 32,
  "80mm": 42,
};

function buildCutMark(width: number): string {
  const label = "✂  - - -  CORTE  - - -  ✂";
  const pad = Math.max(0, Math.floor((width - label.length) / 2));
  return (
    "\n" +
    "─".repeat(width) +
    "\n" +
    " ".repeat(pad) +
    label +
    "\n" +
    "─".repeat(width) +
    "\n\n"
  );
}

// =============================================================
// Helpers parametrizados pela largura
// =============================================================
function center(text: string, width: number): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const left = Math.max(0, Math.floor((width - t.length) / 2));
  return " ".repeat(left) + t + "\n";
}

function divider(char: string, width: number): string {
  return char.repeat(width) + "\n";
}

function wrap(text: string, width: number, indent = ""): string[] {
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

function lineLR(left: string, right: string, width: number): string {
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

function labeled(label: string, value: string, width: number): string {
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

// Largura "dupla" (textos GRANDES) — em ESC/POS isso ocupa 2x cada char.
// Para simular, reduzimos a largura efetiva pela metade.
const dblWidth = (width: number) => Math.max(10, Math.floor(width / 2));
// Triple (GIGANTE) ~ 1/3
const tplWidth = (width: number) => Math.max(8, Math.floor(width / 3));

// =============================================================
// VIA DO CLIENTE
// =============================================================
function buildCustomerPreview(
  order: OrderForPrinting,
  storeName: string,
  width: number
): string {
  let out = "";

  // Cabeçalho — nome da loja "GRANDE" (duplo)
  for (const l of wrap(storeName.toUpperCase(), dblWidth(width)))
    out += center(l, width).replace("\n", "  [GRANDE]\n");

  out += divider("=", width);
  out += center("VIA DO CLIENTE  [NEGRITO]", width);
  out += divider("=", width);

  out += center(`PEDIDO ${shortOrderId(order.id)}  [GRANDE]`, width);
  out += "\n";

  out += labeled("Status: ", String(order.status).toUpperCase(), width);
  out += labeled("Data:   ", formatDateTime(order.created_at), width);
  out += divider("-", width);

  out += labeled("Cliente:", order.customer_name || "-", width);
  if (order.customer_cpf) out += labeled("CPF:    ", order.customer_cpf, width);
  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    out += labeled(
      "Mesa:   ",
      tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`,
      width
    );
  }
  out += divider("-", width);

  out += center("ITENS DO PEDIDO  [NEGRITO]", width);
  out += divider("-", width);

  let total = 0;
  for (const item of order.order_items) {
    const subtotal = item.price_at_order * item.quantity;
    total += subtotal;

    const qty = `${item.quantity}x`.padEnd(3);
    const left = `${qty} ${item.products.name}`;
    out += lineLR(left, formatPrice(subtotal), width);

    if (item.quantity > 1) {
      out +=
        "    " +
        `(${item.quantity} x ${formatPrice(item.price_at_order)})` +
        "\n";
    }

    if (item.notes && item.notes.trim()) {
      const obsLines = wrap(`>> Obs: ${item.notes.trim()}`, width - 4);
      for (const l of obsLines) out += "    " + l + "  [NEGRITO]\n";
    }
    out += "\n";
  }

  out += divider("-", width);
  out += lineLR("Subtotal", formatPrice(total), width);
  out += divider("=", width);
  out += lineLR("TOTAL", formatPrice(total), width) + "  [GRANDE+NEGRITO]\n";
  out += divider("=", width);

  out += "\n";
  out += center("Obrigado pela preferencia!  [NEGRITO]", width);
  out += center("Volte sempre :)", width);
  out += "\n\n";

  return out;
}

// =============================================================
// VIA DA COZINHA
// =============================================================
function buildKitchenPreview(order: OrderForPrinting, width: number): string {
  let out = "";

  out += center("VIA DA COZINHA  [GRANDE+NEGRITO]", width);
  out += divider("=", width);
  out += center(shortOrderId(order.id) + "  [GIGANTE]", width);
  out += divider("=", width);

  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    const mesaStr = tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`;
    out += "MESA: " + mesaStr + "  [GRANDE+NEGRITO]\n";
  }
  out += labeled("Cliente:", order.customer_name || "-", width);
  out += labeled("Hora:   ", formatDateTime(order.created_at), width);
  out += divider("-", width);

  out += center("ITENS A PREPARAR  [NEGRITO]", width);
  out += divider("-", width);

  for (const item of order.order_items) {
    for (const l of wrap(`${item.quantity}x ${item.products.name}`, dblWidth(width)))
      out += l + "  [GRANDE+NEGRITO]\n";

    if (item.notes && item.notes.trim()) {
      const obsLines = wrap(
        `>> OBS: ${item.notes.trim().toUpperCase()}`,
        width
      );
      for (const l of obsLines) out += l + "  [NEGRITO]\n";
    }
    out += divider("-", width);
  }

  out += "\n\n";
  return out;
}

export interface ReceiptPreviewResult {
  customer: string;
  kitchen: string;
  combined: string;
  storeName: string;
  orderId: string;
  lineWidth: number;
  widthLabel: ReceiptWidth;
  cutMark: string;
}

export async function buildReceiptPreview(
  orderId: string,
  widthLabel: ReceiptWidth = "80mm"
): Promise<ReceiptPreviewResult> {
  const width = WIDTH_COLUMNS[widthLabel];
  const [order, storeName] = await Promise.all([
    fetchOrderForPrinting(orderId),
    fetchRestaurantName(orderId),
  ]);
  const customer = buildCustomerPreview(order, storeName, width);
  const kitchen = buildKitchenPreview(order, width);
  const cutMark = buildCutMark(width);
  return {
    customer,
    kitchen,
    combined: customer + cutMark + kitchen + cutMark,
    storeName,
    orderId,
    lineWidth: width,
    widthLabel,
    cutMark,
  };
}
