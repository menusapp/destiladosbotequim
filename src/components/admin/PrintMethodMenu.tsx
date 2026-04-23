/**
 * Botão único de impressão.
 *
 * Toda a plataforma tem APENAS uma opção "Imprimir". O método (PDF ou QZ Tray)
 * é decidido automaticamente pelo `printDispatcher`, com base na configuração
 * salva em Configurações Gerais → Impressoras.
 *
 * Mantemos o nome `PrintMethodMenu` para preservar os imports existentes,
 * mas o componente agora é um botão simples (sem dropdown).
 */

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printDocument } from "@/lib/printDispatcher";
import type { PrintReceiptMode } from "@/lib/printOrderWithQz";

interface PrintMethodMenuProps {
  order: { id: string } & Record<string, any>;
  restaurantId: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  /** Texto do botão. Default "Imprimir". Use "" para apenas ícone. */
  label?: string;
  className?: string;
  stopPropagation?: boolean;
  onPrintTriggered?: () => void;
  /**
   * Contexto da impressão (afeta apenas QZ Tray):
   * - "pedido" (padrão): 2 vias (Cliente + Cozinha).
   * - "conta": 1 via apenas (Cliente) — para fechamento/pagamento.
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
  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    onPrintTriggered?.();
    await printDocument(order, restaurantId, { mode });
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Printer className={label ? "w-4 h-4 mr-2" : "w-4 h-4"} />
      {label}
    </Button>
  );
}
