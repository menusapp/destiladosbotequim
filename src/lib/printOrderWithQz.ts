/**
 * Impressão térmica profissional via QZ Tray (ESC/POS).
 *
 * - Usa fetchOrderForPrinting() para carregar o pedido completo.
 * - Gera DUAS vias (CLIENTE e COZINHA) com comandos ESC/POS.
 * - Aplica CORTE entre as vias e ao final.
 * - NÃO altera a impressão atual (window.print continua intacto).
 *
 * ⚠️ Compatibilidade:
 * Comandos ESC/POS funcionam em impressoras térmicas profissionais
 * (Epson TM-T20, Bematech MP-4200, Elgin i9, etc.).
 * Em impressoras NÃO-ESC/POS (ex.: HP LaserJet P1005), os bytes de
 * controle podem ser ignorados ou impressos como caracteres estranhos
 * — a aplicação NÃO quebra, apenas o corte/negrito não terão efeito.
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
import { resolveQzPrinter } from "@/lib/qzPrinterConfig";

export interface PrintOrderQzResult {
  success: boolean;
  printer: string | null;
  orderId: string;
  escposLikely: boolean;
  error?: string;
}

const LINE_WIDTH = 42; // 80mm térmica, fonte A

// =============================================================
// ESC/POS commands
// =============================================================
const ESC = "\x1B";
const GS = "\x1D";

const ESCPOS = {
  INIT: ESC + "@", // reset
  ALIGN_LEFT: ESC + "a" + "\x00",
  ALIGN_CENTER: ESC + "a" + "\x01",
  ALIGN_RIGHT: ESC + "a" + "\x02",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  DOUBLE_ON: GS + "!" + "\x11", // double width + height
  DOUBLE_OFF: GS + "!" + "\x00",
  // Corte total (full cut). Em impressoras sem suporte é ignorado.
  CUT: GS + "V" + "\x00",
  // Alimenta papel antes de cortar
  FEED_3: "\n\n\n",
};

// =============================================================
// Helpers de formatação
// =============================================================
function pad(text: string, width = LINE_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function divider(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width) + "\n";
}

function lineLR(left: string, right: string, width = LINE_WIDTH): string {
  const space = Math.max(1, width - right.length);
  const l = left.length > space - 1 ? left.slice(0, space - 1) : left;
  return l + " ".repeat(width - l.length - right.length) + right + "\n";
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function shortOrderId(id: string): string {
  return "#" + id.slice(0, 8).toUpperCase();
}

// =============================================================
// Restaurante (nome da loja)
// =============================================================
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

// =============================================================
// Construção das vias
// =============================================================
function buildCustomerReceipt(
  order: OrderForPrinting,
  storeName: string
): string {
  let out = "";
  out += ESCPOS.INIT;

  // Cabeçalho (loja)
  out += ESCPOS.ALIGN_CENTER;
  out += ESCPOS.BOLD_ON + ESCPOS.DOUBLE_ON;
  out += storeName.toUpperCase() + "\n";
  out += ESCPOS.DOUBLE_OFF + ESCPOS.BOLD_OFF;
  out += "\n";
  out += ESCPOS.BOLD_ON + "VIA DO CLIENTE" + ESCPOS.BOLD_OFF + "\n";

  // Corpo
  out += ESCPOS.ALIGN_LEFT;
  out += divider("=");
  out += `Pedido: ${shortOrderId(order.id)}\n`;
  out += `Status: ${order.status}\n`;
  out += `Data:   ${formatDateTime(order.created_at)}\n`;
  out += divider();

  out += `Cliente: ${order.customer_name || "-"}\n`;
  if (order.customer_cpf) out += `CPF:     ${order.customer_cpf}\n`;
  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    out += `Mesa:    ${tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`}\n`;
  }
  out += divider();

  // Itens
  out += ESCPOS.BOLD_ON + pad("ITENS") + "\n" + ESCPOS.BOLD_OFF;
  out += divider();

  let total = 0;
  for (const item of order.order_items) {
    const subtotal = item.price_at_order * item.quantity;
    total += subtotal;
    out += lineLR(
      `${item.quantity}x ${item.products.name}`,
      formatPrice(subtotal)
    );
    if (item.notes && item.notes.trim()) {
      out += `   Obs: ${item.notes.trim()}\n`;
    }
  }

  out += divider();
  out += ESCPOS.BOLD_ON + lineLR("TOTAL", formatPrice(total)) + ESCPOS.BOLD_OFF;
  out += divider("=");

  out += ESCPOS.ALIGN_CENTER;
  out += "Obrigado pela preferencia!\n";

  out += ESCPOS.FEED_3;
  out += ESCPOS.CUT;
  return out;
}

function buildKitchenReceipt(order: OrderForPrinting): string {
  let out = "";
  out += ESCPOS.INIT;

  out += ESCPOS.ALIGN_CENTER;
  out += ESCPOS.BOLD_ON + ESCPOS.DOUBLE_ON;
  out += "VIA DA COZINHA\n";
  out += ESCPOS.DOUBLE_OFF;
  out += `Pedido ${shortOrderId(order.id)}\n`;
  out += ESCPOS.BOLD_OFF;

  out += ESCPOS.ALIGN_LEFT;
  out += divider("=");

  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    out +=
      ESCPOS.BOLD_ON +
      `MESA: ${tname ? `${tname} (Nº ${tnum})` : tnum}\n` +
      ESCPOS.BOLD_OFF;
  }
  out += `Cliente: ${order.customer_name || "-"}\n`;
  out += `Hora:    ${formatDateTime(order.created_at)}\n`;
  out += divider();

  out += ESCPOS.BOLD_ON + "ITENS A PREPARAR\n" + ESCPOS.BOLD_OFF;
  out += divider();

  for (const item of order.order_items) {
    out +=
      ESCPOS.BOLD_ON +
      ESCPOS.DOUBLE_ON +
      `${item.quantity}x ${item.products.name}\n` +
      ESCPOS.DOUBLE_OFF +
      ESCPOS.BOLD_OFF;

    if (item.notes && item.notes.trim()) {
      out += ESCPOS.BOLD_ON;
      out += `>> OBS: ${item.notes.trim().toUpperCase()}\n`;
      out += ESCPOS.BOLD_OFF;
    }
    out += "\n";
  }

  out += divider("=");
  out += ESCPOS.FEED_3;
  out += ESCPOS.CUT;
  return out;
}

// =============================================================
// Detecção heurística de impressora ESC/POS
// =============================================================
function looksLikeEscposPrinter(printerName: string): boolean {
  const n = printerName.toLowerCase();
  const escposHints = [
    "epson",
    "tm-",
    "bematech",
    "mp-4200",
    "elgin",
    "i9",
    "daruma",
    "thermal",
    "termica",
    "pos-",
    "pos58",
    "pos80",
    "generic / text only",
  ];
  const nonEscposHints = ["laserjet", "deskjet", "officejet", "inkjet", "hp p"];
  if (nonEscposHints.some((h) => n.includes(h))) return false;
  if (escposHints.some((h) => n.includes(h))) return true;
  return false;
}

// =============================================================
// Função principal
// =============================================================
export async function printOrderWithQz(
  orderId: string,
  printerName?: string
): Promise<PrintOrderQzResult> {
  console.group(`🖨️ [QZ Tray] Impressão ESC/POS do pedido ${orderId}`);

  let usedPrinter: string | null = null;
  let escposLikely = false;

  try {
    console.log("⏳ Carregando pedido…");
    const [order, storeName] = await Promise.all([
      fetchOrderForPrinting(orderId),
      fetchRestaurantName(orderId),
    ]);
    console.log("✅ Pedido carregado:", order);
    console.log("🏪 Loja:", storeName);

    if (!qz.websocket.isActive()) {
      console.log("⏳ Conectando ao QZ Tray (ws://localhost:8181)…");
      await qz.websocket.connect();
    } else {
      console.log("ℹ️ Já estava conectado ao QZ Tray.");
    }

    if (printerName) {
      usedPrinter = printerName;
      console.log(`🎯 [QZ] Impressora informada via parâmetro: "${printerName}"`);
    } else {
      const resolved = await resolveQzPrinter();
      usedPrinter = resolved.printer;
      console.log(`📌 [QZ] Origem da impressora: ${resolved.source}`);
    }

    if (!usedPrinter) {
      throw new Error(
        "Nenhuma impressora encontrada. Defina uma padrão no SO ou passe o nome."
      );
    }
    console.log("🖨️ Impressora utilizada:", usedPrinter);

    escposLikely = looksLikeEscposPrinter(usedPrinter);
    if (!escposLikely) {
      console.warn(
        "⚠️ A impressora selecionada NÃO parece ser ESC/POS térmica.\n" +
          "Os comandos de corte e negrito podem ser ignorados ou impressos como caracteres estranhos.\n" +
          "Use uma impressora térmica (Epson TM-, Bematech, Elgin i9, etc.) para o resultado final."
      );
    } else {
      console.log("✅ Impressora compatível com ESC/POS detectada.");
    }

    const customer = buildCustomerReceipt(order, storeName);
    const kitchen = buildKitchenReceipt(order);

    console.log("📄 Via do CLIENTE preparada.");
    console.log("📄 Via da COZINHA preparada.");

    const config = qz.configs.create(usedPrinter);

    // Duas vias — corte já incluso ao final de cada bloco
    const data = [
      { type: "raw", format: "plain", data: customer },
      { type: "raw", format: "plain", data: kitchen },
    ];

    console.log("🚀 Iniciando impressão das duas vias…");
    await qz.print(config, data);

    console.log("✅ Impressão enviada com sucesso.");
    console.groupEnd();
    return { success: true, printer: usedPrinter, orderId, escposLikely };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Falha na impressão do pedido:", message);
    console.groupEnd();
    return {
      success: false,
      printer: usedPrinter,
      orderId,
      escposLikely,
      error: message,
    };
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
