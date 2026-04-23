/**
 * Botão de imprimir com escolha de método (padrão / PDF / QZ Tray).
 *
 * Reutilizado em todos os pontos do painel onde existe um botão de imprimir
 * (lista de pedidos, modal de detalhes, mesa, etc.). Garante UX consistente
 * e respeita o método padrão configurado em Impressoras.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Printer, ChevronDown, FileText, Zap } from "lucide-react";
import { getPrintMethod, printDocument, type PrintMethod } from "@/lib/printDispatcher";
import type { PrintReceiptMode } from "@/lib/printOrderWithQz";

interface PrintMethodMenuProps {
  order: { id: string } & Record<string, any>;
  restaurantId: string;
  /** Tamanho do botão. Default 'sm'. */
  size?: "sm" | "default" | "lg" | "icon";
  /** Variant do botão. Default 'outline'. */
  variant?: "default" | "outline" | "secondary" | "ghost";
  /** Texto exibido no botão. Default "Imprimir". Use "" para ocultar (apenas ícone). */
  label?: string;
  /** Classe extra no botão trigger. */
  className?: string;
  /** Para com a propagação do clique (útil dentro de cards clicáveis). */
  stopPropagation?: boolean;
  /** Callback após disparo (independe de sucesso). */
  onPrintTriggered?: () => void;
  /**
   * Contexto da impressão (afeta apenas o motor QZ Tray):
   * - "pedido" (padrão): imprime 2 vias (Cliente + Cozinha).
   * - "conta": imprime apenas 1 via (Cliente) — para fechamento/pagamento.
   */
  mode?: PrintReceiptMode;
}

export function PrintMethodMenu({
  order,
  restaurantId,
  size = "sm",
  variant = "outline",
  label = "Imprimir",
  className,
  stopPropagation = false,
  onPrintTriggered,
  mode = "pedido",
}: PrintMethodMenuProps) {
  const [defaultMethod, setDefaultMethod] = useState<PrintMethod>("pdf");

  useEffect(() => {
    let active = true;
    getPrintMethod(restaurantId).then((m) => {
      if (active) setDefaultMethod(m);
    });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const stop = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const handle = async (opts?: { forcePdf?: boolean; forceQz?: boolean }) => {
    onPrintTriggered?.();
    await printDocument(order, restaurantId, { ...opts, mode });
  };

  const defaultLabel = defaultMethod === "qz_tray" ? "QZ Tray" : "PDF";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop}>
        <Button variant={variant} size={size} className={className}>
          <Printer className={label ? "w-4 h-4 mr-2" : "w-4 h-4"} />
          {label}
          {label ? <ChevronDown className="w-3 h-3 ml-1 opacity-70" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        <DropdownMenuItem onClick={() => handle()}>
          <Printer className="w-3.5 h-3.5 mr-2" />
          Usar padrão ({defaultLabel})
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handle({ forcePdf: true })}>
          <FileText className="w-3.5 h-3.5 mr-2" />
          Abrir como PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle({ forceQz: true })}>
          <Zap className="w-3.5 h-3.5 mr-2" />
          QZ Tray direto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
