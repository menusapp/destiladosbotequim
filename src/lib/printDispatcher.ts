/**
 * Despachante central de impressão.
 *
 * Lê a preferência `print_method` salva em `printer_settings` (por restaurante)
 * e roteia para o caminho correto: PDF (window.print) ou QZ Tray (ESC/POS).
 *
 * O operador também pode forçar um método específico via `forcePdf` / `forceQz`
 * — útil para o menu dropdown nos botões de impressão.
 *
 * Todos os botões de imprimir do painel devem usar `printDocument()` em vez
 * de chamar `printOrder` ou `printOrderWithQz` diretamente. Assim:
 *   - a configuração do restaurante é respeitada;
 *   - se um dia mudarmos o motor de impressão, basta alterar este arquivo.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { printOrder } from "@/lib/printOrder";
import { printOrderWithQz, type PrintReceiptMode } from "@/lib/printOrderWithQz";
import { getSavedQzPrinter } from "@/lib/qzPrinterConfig";
import { checkQzTrayConnection } from "@/lib/qzConnectionCheck";

export type PrintMethod = "pdf" | "qz_tray";

export interface PrintDocumentOptions {
  /** Força o uso do diálogo do navegador, ignorando a preferência salva. */
  forcePdf?: boolean;
  /** Força o uso do QZ Tray, ignorando a preferência salva. */
  forceQz?: boolean;
  /** Mostrar toasts informativos (default: true). */
  showToasts?: boolean;
  /**
   * Contexto da impressão (afeta apenas QZ Tray):
   * - "pedido" (padrão): 2 vias (Cliente + Cozinha) com corte entre elas.
   * - "conta": 1 via apenas (Cliente) — usado em fechamento/pagamento.
   *
   * No motor PDF (window.print) o sistema operacional gera 1 cópia por padrão,
   * portanto este parâmetro só altera o comportamento quando method === "qz_tray".
   */
  mode?: PrintReceiptMode;
}

/**
 * Lê o método de impressão padrão configurado para o restaurante.
 * Em caso de erro/registro inexistente, retorna 'pdf' (comportamento legado seguro).
 */
export async function getPrintMethod(restaurantId: string): Promise<PrintMethod> {
  try {
    const { data } = await supabase
      .from("printer_settings")
      .select("print_method")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    const value = (data as any)?.print_method;
    return value === "qz_tray" ? "qz_tray" : "pdf";
  } catch (e) {
    console.warn("[printDispatcher] Falha ao ler print_method, usando 'pdf':", e);
    return "pdf";
  }
}

/**
 * Imprime um pedido respeitando a configuração do restaurante.
 *
 * - `order`: objeto compatível com `printOrder` (já hidratado com items/extras)
 *            — necessário para o caminho PDF, que NÃO refaz fetch.
 * - `restaurantId`: para resolver a configuração e (no QZ) refazer fetch completo.
 * - `options`: força método específico ou silencia toasts.
 */
export async function printDocument(
  order: { id: string } & Record<string, any>,
  restaurantId: string,
  options: PrintDocumentOptions = {}
): Promise<void> {
  const { forcePdf, forceQz, showToasts = true, mode = "pedido" } = options;

  let method: PrintMethod;
  if (forcePdf) method = "pdf";
  else if (forceQz) method = "qz_tray";
  else method = await getPrintMethod(restaurantId);

  console.log(
    `🖨️ [printDispatcher] Método: ${method} | Modo: ${mode} ` +
      `(forced=${forcePdf || forceQz ? "yes" : "no"})`
  );

  if (method === "pdf") {
    await printOrder(order as any, restaurantId);
    return;
  }

  // QZ Tray: validações antes de tentar imprimir (mantém UX do fluxo antigo)
  const saved = getSavedQzPrinter();
  if (!saved) {
    if (showToasts) {
      toast.warning("Nenhuma impressora térmica configurada", {
        description:
          "Vá em Configurações Gerais → Impressoras para selecionar uma impressora QZ Tray.",
        duration: 6000,
      });
    }
    return;
  }

  // Verifica conexão silenciosamente — se precisar conectar, usa o manager central
  // e mantém o socket aberto para as próximas impressões.
  const status = await checkQzTrayConnection({ connectIfNeeded: true });
  if (!status.ok) {
    if (showToasts) {
      toast.error("QZ Tray não está conectado", {
        description:
          "Abra o aplicativo QZ Tray na sua máquina e tente novamente. Se ainda não tem instalado, baixe em qz.io.",
        duration: 8000,
      });
    }
    return;
  }

  // Não mostramos mais toasts de "loading" nem de "sucesso" — apenas erros.
  const checkToastId = undefined;

  try {
    const result = await printOrderWithQz(order.id, { mode });
    if (!showToasts) return;

    if (result.success) {
      // Sucesso silencioso: nenhuma notificação.
      return;
    }

    const code = result.errorCode;
    if (code === "printer_not_available") {
      toast.error("Impressora indisponível", {
        id: checkToastId,
        description: `"${saved}" não está conectada. Vá em Configurações Gerais → Impressoras e escolha outra.`,
        duration: 9000,
      });
    } else if (code === "no_printers_found") {
      toast.error("Nenhuma impressora detectada", {
        id: checkToastId,
        description: "Conecte uma impressora ao computador e tente novamente.",
        duration: 8000,
      });
    } else if (code === "print_timeout") {
      toast.error("Tempo esgotado na impressão", {
        id: checkToastId,
        description: `A impressora "${saved}" não respondeu. Verifique se está ligada e online.`,
        duration: 9000,
      });
    } else if (code === "qz_connect_failed") {
      toast.error("QZ Tray não respondeu", {
        id: checkToastId,
        description: "Verifique se o aplicativo QZ Tray está aberto.",
        duration: 8000,
      });
    } else {
      toast.error("Erro ao imprimir via QZ Tray", {
        id: checkToastId,
        description: result.error ?? "Falha desconhecida",
        duration: 8000,
      });
    }
  } catch (err: any) {
    if (showToasts) {
      toast.error("Erro inesperado na impressão", {
        id: checkToastId,
        description: err?.message ?? String(err),
        duration: 8000,
      });
    }
    console.error("[printDispatcher] erro inesperado:", err);
  }
}
