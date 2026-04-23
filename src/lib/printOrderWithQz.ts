/**
 * Impressão de pedido REAL via QZ Tray (modo texto puro).
 *
 * - Usa fetchOrderForPrinting() para carregar o pedido completo.
 * - Imprime em "raw / plain", SEM ESC/POS e SEM corte (ainda).
 * - NÃO altera a impressão atual (window.print continua intacto).
 *
 * Uso no DevTools:
 *   await window.printOrderWithQz("ID_DO_PEDIDO")
 *   await window.printOrderWithQz("ID_DO_PEDIDO", "Nome Impressora")
 */

import qz from "qz-tray";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOrderForPrinting,
  type OrderForPrinting,
} from "@/lib/fetchOrderForPrinting";

export interface PrintOrderQzResult {
  success: boolean;
  printer: string | null;
  orderId: string;
  error?: string;
}

const LINE_WIDTH = 42; // largura típica de impressora térmica 80mm

function pad(text: string, width = LINE_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function center(text: string, width = LINE_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return " ".repeat(left) + text;
}

function divider(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width);
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

async function fetchRestaurantName(orderId: string): Promise<string> {
  const { data, error } = await supabase
    .from("orders")
    .select("restaurant_id, restaurants:restaurant_id(name)")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    console.warn("[printOrderWithQz] Falha ao buscar nome da loja:", error);
    return "Loja";
  }
  const name = (data as any).restaurants?.name;
  return typeof name === "string" && name.length > 0 ? name : "Loja";
}

function buildReceiptText(
  order: OrderForPrinting,
  storeName: string
): string {
  const lines: string[] = [];

  // Cabeçalho
  lines.push(center(storeName.toUpperCase()));
  lines.push(divider("="));
  lines.push(`Pedido: #${order.id.slice(0, 8).toUpperCase()}`);
  lines.push(`Status: ${order.status}`);
  lines.push(`Data:   ${formatDateTime(order.created_at)}`);
  lines.push(divider());

  // Cliente
  lines.push(`Cliente: ${order.customer_name || "-"}`);
  if (order.customer_cpf) {
    lines.push(`CPF:     ${order.customer_cpf}`);
  }

  // Mesa
  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    const mesaLabel = tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`;
    lines.push(`Mesa:    ${mesaLabel}`);
  }

  lines.push(divider());

  // Itens
  lines.push(pad("ITENS"));
  lines.push(divider());

  for (const item of order.order_items) {
    const qtyName = `${item.quantity}x ${item.products.name}`;
    const price = formatPrice(item.price_at_order * item.quantity);
    // Linha qty+nome alinhada à esquerda; preço à direita
    const space = LINE_WIDTH - price.length;
    const left =
      qtyName.length > space - 1 ? qtyName.slice(0, space - 1) : qtyName;
    lines.push(left + " ".repeat(LINE_WIDTH - left.length - price.length) + price);

    if (item.notes && item.notes.trim().length > 0) {
      lines.push(`   Obs: ${item.notes.trim()}`);
    }
  }

  lines.push(divider("="));
  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

export async function printOrderWithQz(
  orderId: string,
  printerName?: string
): Promise<PrintOrderQzResult> {
  console.group(`🖨️ [QZ Tray] Impressão de pedido ${orderId}`);

  let usedPrinter: string | null = null;

  try {
    // 1) Carrega pedido + nome da loja
    console.log("⏳ Carregando pedido…");
    const [order, storeName] = await Promise.all([
      fetchOrderForPrinting(orderId),
      fetchRestaurantName(orderId),
    ]);
    console.log("✅ Pedido carregado:", order);
    console.log("🏪 Loja:", storeName);

    // 2) Conecta QZ Tray
    if (!qz.websocket.isActive()) {
      console.log("⏳ Conectando ao QZ Tray (ws://localhost:8181)…");
      await qz.websocket.connect();
    } else {
      console.log("ℹ️ Já estava conectado ao QZ Tray.");
    }

    // 3) Resolve impressora
    if (printerName) {
      usedPrinter = printerName;
    } else {
      usedPrinter = (await qz.printers.getDefault()) as string;
    }
    if (!usedPrinter) {
      throw new Error(
        "Nenhuma impressora encontrada. Defina uma padrão no SO ou passe o nome."
      );
    }
    console.log("🖨️ Impressora utilizada:", usedPrinter);

    // 4) Monta texto e envia (raw plain, sem ESC/POS, sem corte)
    const receipt = buildReceiptText(order, storeName);
    console.log("📄 Conteúdo:\n" + receipt);

    const config = qz.configs.create(usedPrinter);
    const data = [{ type: "raw", format: "plain", data: receipt }];

    console.log("🚀 Iniciando impressão…");
    await qz.print(config, data);

    console.log("✅ Impressão enviada com sucesso.");
    console.groupEnd();
    return { success: true, printer: usedPrinter, orderId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Falha na impressão do pedido:", message);
    console.groupEnd();
    return { success: false, printer: usedPrinter, orderId, error: message };
  } finally {
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
        console.log("🔌 [QZ Tray] Desconectado.");
      }
    } catch {
      // ignore
    }
  }
}

if (typeof window !== "undefined") {
  (window as any).printOrderWithQz = printOrderWithQz;
}
