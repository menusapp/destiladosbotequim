import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  QrCode,
  Link2,
  Eye,
  EyeOff,
  Eraser,
  Bell,
  Clock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TableCardMobileProps {
  table: {
    id: string;
    table_number: number;
    table_name: string | null;
    is_occupied: boolean;
    is_hidden: boolean;
    occupied_at: string | null;
    comandas?: { id: string; customer_name: string }[];
  };
  isSelected: boolean;
  pendingCount: number;
  itemCount: number;
  reservationTime?: string | null;
  onClick: () => void;
  onShowQR: () => void;
  onCopyLink: () => void;
  onToggleHidden: () => void;
  onClearTable: () => void;
}

function useElapsedMinutes(start?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!start) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [start]);
  if (!start) return null;
  const mins = Math.max(0, Math.floor((now - new Date(start).getTime()) / 60_000));
  return mins;
}

export function TableCardMobile(props: TableCardMobileProps) {
  const {
    table,
    isSelected,
    pendingCount,
    itemCount,
    reservationTime,
    onClick,
    onShowQR,
    onCopyLink,
    onToggleHidden,
    onClearTable,
  } = props;

  const isOccupied = table.is_occupied;
  const elapsed = useElapsedMinutes(table.occupied_at);
  const comandaCount = table.comandas?.length || 0;

  // Status color: hidden / free / occupied <30 / occupied >=30 / pending
  let statusColor = "bg-emerald-500";
  let cardBg = "bg-card border-border";
  let ring = "";
  if (table.is_hidden) {
    statusColor = "bg-muted-foreground/40";
    cardBg = "bg-muted/40 border-border opacity-60";
  } else if (pendingCount > 0) {
    statusColor = "bg-blue-500 animate-pulse";
    cardBg = "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800";
  } else if (isOccupied) {
    if ((elapsed ?? 0) >= 30) {
      statusColor = "bg-red-500";
      cardBg = "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-900";
    } else {
      statusColor = "bg-amber-500";
      cardBg = "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900";
    }
  }
  if (isSelected) ring = "ring-2 ring-primary";

  return (
    <button
      type="button"
      disabled={table.is_hidden}
      onClick={onClick}
      className={cn(
        "relative w-full text-left rounded-2xl border-2 p-3 min-h-[124px] transition-all",
        "active:scale-[0.97] active:shadow-inner",
        cardBg,
        ring
      )}
    >
      {/* Status dot top-left */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", statusColor)} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {table.is_hidden
              ? "Oculta"
              : pendingCount > 0
              ? "Novo pedido"
              : isOccupied
              ? "Ocupada"
              : "Livre"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-1 -mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onShowQR}>
              <QrCode className="w-4 h-4 mr-2" /> QR Code
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyLink}>
              <Link2 className="w-4 h-4 mr-2" /> Copiar Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleHidden}>
              {table.is_hidden ? (
                <Eye className="w-4 h-4 mr-2" />
              ) : (
                <EyeOff className="w-4 h-4 mr-2" />
              )}
              {table.is_hidden ? "Tornar Visível" : "Ocultar Mesa"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onClearTable}
              className="text-destructive focus:text-destructive"
            >
              <Eraser className="w-4 h-4 mr-2" /> Limpar Mesa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Big number */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[32px] leading-none font-extrabold tracking-tight">
          {table.table_number}
        </span>
        {table.table_name && (
          <span className="text-[11px] text-muted-foreground truncate">
            {table.table_name}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {isOccupied && elapsed !== null && (
          <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-background/70 border border-border text-[11px] font-medium">
            <Clock className="w-3 h-3" />
            {elapsed < 60 ? `${elapsed} min` : `${Math.floor(elapsed / 60)}h${elapsed % 60}`}
          </span>
        )}
        {comandaCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-background/70 border border-border text-[11px] font-medium">
            <Users className="w-3 h-3" />
            {comandaCount}
          </span>
        )}
        {itemCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-background/70 border border-border text-[11px] font-medium">
            📋 {itemCount}
          </span>
        )}
        {!isOccupied && reservationTime && (
          <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-medium">
            🕐 {reservationTime.slice(0, 5)}
          </span>
        )}
      </div>

      {/* Pending pulse badge */}
      {pendingCount > 0 && (
        <Badge className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] h-5 px-1.5 shadow-md flex items-center gap-1">
          <Bell className="w-2.5 h-2.5" /> {pendingCount}
        </Badge>
      )}

      {/* Customer names preview */}
      {isOccupied && table.comandas && table.comandas.length > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
          {table.comandas.map((c) => c.customer_name).join(", ")}
        </p>
      )}
    </button>
  );
}
