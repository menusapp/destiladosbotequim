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
  /** Código semântico para o frontend tratar diferentes cenários de erro. */
  errorCode?:
    | "no_printer_configured"
    | "printer_not_available"
    | "no_printers_found"
    | "print_timeout"
    | "qz_connect_failed"
    | "unknown";
}

/** Tempo máximo (ms) que o envio para a impressora pode demorar antes de abortar. */
const PRINT_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${label} demorou mais de ${ms}ms.`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

const LINE_WIDTH = 42; // 80mm térmica, fonte A

// =============================================================
// ESC/POS commands
// =============================================================
const ESC = "\x1B";
const GS = "\x1D";

const ESCPOS = {
  INIT: ESC + "@",
  ALIGN_LEFT: ESC + "a" + "\x00",
  ALIGN_CENTER: ESC + "a" + "\x01",
  ALIGN_RIGHT: ESC + "a" + "\x02",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  UNDERLINE_ON: ESC + "-" + "\x01",
  UNDERLINE_OFF: ESC + "-" + "\x00",
  // GS ! n  (nibble alto = altura, nibble baixo = largura)
  SIZE_NORMAL: GS + "!" + "\x00",
  SIZE_DOUBLE_W: GS + "!" + "\x10",
  SIZE_DOUBLE_H: GS + "!" + "\x01",
  SIZE_DOUBLE: GS + "!" + "\x11",
  SIZE_TRIPLE: GS + "!" + "\x22",
  CUT: GS + "V" + "\x00",
  FEED_2: "\n\n",
  FEED_3: "\n\n\n",
};

// =============================================================
// Helpers de formatação
// =============================================================
function center(text: string, width = LINE_WIDTH): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const left = Math.max(0, Math.floor((width - t.length) / 2));
  return " ".repeat(left) + t + "\n";
}

function divider(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width) + "\n";
}

/** Word-wrap respeitando palavras; quebra à força palavras maiores que a largura. */
function wrap(text: string, width = LINE_WIDTH, indent = ""): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const max = Math.max(1, width - indent.length);
  const pushWord = (w: string) => {
    if (!current.length) {
      if (w.length > max) {
        for (let i = 0; i < w.length; i += max) lines.push(indent + w.slice(i, i + max));
      } else current = w;
    } else if (current.length + 1 + w.length <= max) {
      current += " " + w;
    } else {
      lines.push(indent + current);
      current = "";
      if (w.length > max) {
        for (let i = 0; i < w.length; i += max) lines.push(indent + w.slice(i, i + max));
      } else current = w;
    }
  };
  for (const w of words) pushWord(w);
  if (current.length) lines.push(indent + current);
  return lines;
}

/** Linha esquerda + direita; preço encostado na borda direita (1ª linha). */
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

/** "Rótulo: valor" com wrap alinhado ao rótulo. */
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

  // ---------- Cabeçalho: nome da loja ----------
  out += ESCPOS.ALIGN_CENTER;
  out += ESCPOS.BOLD_ON + ESCPOS.SIZE_DOUBLE;
  for (const l of wrap(storeName.toUpperCase(), 21)) out += l + "\n";
  out += ESCPOS.SIZE_NORMAL + ESCPOS.BOLD_OFF;

  out += divider("=");
  out += ESCPOS.BOLD_ON + center("VIA DO CLIENTE") + ESCPOS.BOLD_OFF;
  out += divider("=");

  // ---------- Número do pedido em destaque ----------
  out += ESCPOS.BOLD_ON + ESCPOS.SIZE_DOUBLE;
  out += center(`PEDIDO ${shortOrderId(order.id)}`, 21);
  out += ESCPOS.SIZE_NORMAL + ESCPOS.BOLD_OFF;
  out += "\n";

  // ---------- Bloco: dados do pedido ----------
  out += ESCPOS.ALIGN_LEFT;
  out += labeled("Status: ", String(order.status).toUpperCase());
  out += labeled("Data:   ", formatDateTime(order.created_at));
  out += divider();

  // ---------- Bloco: cliente ----------
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

  // ---------- Bloco: itens ----------
  out += ESCPOS.BOLD_ON + center("ITENS DO PEDIDO") + ESCPOS.BOLD_OFF;
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
      out += ESCPOS.BOLD_ON;
      for (const l of obsLines) out += "    " + l + "\n";
      out += ESCPOS.BOLD_OFF;
    }
    out += "\n";
  }

  out += divider();

  // ---------- Totais ----------
  out += lineLR("Subtotal", formatPrice(total));
  out += divider("=");
  out += ESCPOS.BOLD_ON + ESCPOS.SIZE_DOUBLE_H;
  out += lineLR("TOTAL", formatPrice(total));
  out += ESCPOS.SIZE_NORMAL + ESCPOS.BOLD_OFF;
  out += divider("=");

  // ---------- Rodapé ----------
  out += "\n";
  out += ESCPOS.ALIGN_CENTER;
  out += ESCPOS.BOLD_ON + "Obrigado pela preferencia!\n" + ESCPOS.BOLD_OFF;
  out += "Volte sempre :)\n";

  out += ESCPOS.FEED_3;
  out += ESCPOS.CUT;
  return out;
}

function buildKitchenReceipt(order: OrderForPrinting): string {
  let out = "";
  out += ESCPOS.INIT;

  // ---------- Cabeçalho ----------
  out += ESCPOS.ALIGN_CENTER;
  out += ESCPOS.BOLD_ON + ESCPOS.SIZE_DOUBLE;
  out += center("VIA DA COZINHA", 21);
  out += ESCPOS.SIZE_NORMAL;
  out += divider("=");

  // Número do pedido bem grande (3x)
  out += ESCPOS.SIZE_TRIPLE;
  out += center(shortOrderId(order.id), 14);
  out += ESCPOS.SIZE_NORMAL + ESCPOS.BOLD_OFF;
  out += divider("=");

  // ---------- Identificação ----------
  out += ESCPOS.ALIGN_LEFT;
  if (order.tables) {
    const tname = order.tables.table_name?.trim();
    const tnum = order.tables.table_number;
    const mesaStr = tname ? `${tname} (Nº ${tnum})` : `Mesa ${tnum}`;
    out += ESCPOS.BOLD_ON + ESCPOS.SIZE_DOUBLE_H;
    out += "MESA: " + mesaStr + "\n";
    out += ESCPOS.SIZE_NORMAL + ESCPOS.BOLD_OFF;
  }
  out += labeled("Cliente:", order.customer_name || "-");
  out += labeled("Hora:   ", formatDateTime(order.created_at));
  out += divider();

  // ---------- Itens ----------
  out += ESCPOS.BOLD_ON + center("ITENS A PREPARAR") + ESCPOS.BOLD_OFF;
  out += divider();

  for (const item of order.order_items) {
    out += ESCPOS.BOLD_ON + ESCPOS.SIZE_DOUBLE;
    for (const l of wrap(`${item.quantity}x ${item.products.name}`, 21))
      out += l + "\n";
    out += ESCPOS.SIZE_NORMAL + ESCPOS.BOLD_OFF;

    if (item.notes && item.notes.trim()) {
      const obsLines = wrap(
        `>> OBS: ${item.notes.trim().toUpperCase()}`,
        LINE_WIDTH
      );
      out += ESCPOS.BOLD_ON;
      for (const l of obsLines) out += l + "\n";
      out += ESCPOS.BOLD_OFF;
    }
    out += divider("-");
  }

  out += "\n";
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
