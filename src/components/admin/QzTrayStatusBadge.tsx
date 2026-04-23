/**
 * Indicador discreto de status do QZ Tray + impressora salva.
 *
 * Este badge faz apenas checagem PASSIVA por padrão para não disparar popup
 * inesperado. A conexão real acontece apenas quando o usuário precisa imprimir
 * ou quando clica explicitamente para testar/conectar.
 */
import { useEffect, useState, useCallback } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSavedQzPrinter } from "@/lib/qzPrinterConfig";
import { checkQzTrayConnection } from "@/lib/qzConnectionCheck";

type QzStatus = "checking" | "ready" | "no-printer" | "disconnected";

interface QzTrayStatusBadgeProps {
  /** Intervalo de re-checagem em ms. 0 = não recheca automaticamente. */
  pollIntervalMs?: number;
}

export const QzTrayStatusBadge = ({
  pollIntervalMs = 60_000,
}: QzTrayStatusBadgeProps) => {
  const [status, setStatus] = useState<QzStatus>("checking");
  const [printer, setPrinter] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("checking");
    const saved = getSavedQzPrinter();
    setPrinter(saved);
    const conn = await checkQzTrayConnection({ connectIfNeeded: false });
    if (!conn.ok) {
      setStatus("disconnected");
      return;
    }
    setStatus(saved ? "ready" : "no-printer");
  }, []);

  useEffect(() => {
    refresh();
    if (pollIntervalMs > 0) {
      const id = setInterval(refresh, pollIntervalMs);
      return () => clearInterval(id);
    }
  }, [refresh, pollIntervalMs]);

  const meta = (() => {
    switch (status) {
      case "checking":
        return {
          dot: "bg-muted-foreground/40",
          label: "Verificando QZ...",
          tip: "Verificando status do QZ Tray sem abrir conexão automaticamente",
        };
      case "ready":
        return {
          dot: "bg-emerald-500",
          label: "QZ pronto",
          tip: `QZ Tray conectado · Impressora: ${printer}`,
        };
      case "no-printer":
        return {
          dot: "bg-amber-500",
          label: "Sem impressora",
          tip: "QZ Tray conectado, mas nenhuma impressora foi configurada. Vá em Configurações Gerais → Impressoras.",
        };
      case "disconnected":
      default:
        return {
          dot: "bg-destructive",
          label: "QZ desconectado",
          tip: "QZ Tray não está conectado no momento. A conexão só será aberta quando necessária.",
        };
    }
  })();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background hover:bg-accent transition-colors text-xs"
            aria-label="Status do QZ Tray (clique para atualizar)"
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                meta.dot,
                status === "checking" && "animate-pulse"
              )}
            />
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground hidden md:inline">
              {meta.label}
            </span>
            <RefreshCw className="w-3 h-3 text-muted-foreground/60 ml-0.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{meta.tip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
