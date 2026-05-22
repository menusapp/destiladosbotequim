import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreVertical,
  Eye,
  Printer,
  ScrollText,
  XCircle,
  CalendarClock,
} from "lucide-react";
import { format } from "date-fns";

interface OrderItemExtra {
  price_at_order: number;
  extra_name?: string | null;
  product_extras: { name: string } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  notes?: string;
  products: { name: string } | null;
  order_item_extras: OrderItemExtra[];
}

export interface OrderCardOrder {
  id: string;
  daily_order_number?: number | null;
  status: string;
  created_at: string;
  customer_name: string;
  customer_cpf: string;
  delivery_type?: string;
  order_type?: string;
  delivery_address?: string;
  delivery_phone?: string;
  payment_type?: string;
  payment_brand?: string;
  table_id?: string;
  tables?: { table_number: number };
  order_items: OrderItem[];
  delivery_fee?: number;
  coupon_discount?: number;
  loyalty_points_used?: number;
  ifood_source?: boolean;
  dd_source?: boolean;
  dd_scheduled_for?: string;
}

interface NextStatus {
  status: string;
  label: string;
}

interface PaymentDisplay {
  label: string;
  className: string;
  icon: React.ReactNode;
}

interface OrderCardProps {
  order: OrderCardOrder;
  showPrepTimer: boolean;
  canManageOrders: boolean;
  isAdvancing: boolean;
  next: NextStatus | null;
  payment: PaymentDisplay;
  typeIcon: React.ReactNode;
  typeLabel: string;
  grandTotal: number;
  elapsed: number;
  elapsedClass: string;
  onSelect: (order: OrderCardOrder) => void;
  onAdvance: (e: React.MouseEvent, order: OrderCardOrder) => void;
  onPrint: (e: React.MouseEvent, order: OrderCardOrder) => void;
  onPreview: (orderId: string) => void;
  onCancel: (e: React.MouseEvent, order: OrderCardOrder) => void;
}

const OrderCardBase = ({
  order,
  showPrepTimer,
  canManageOrders,
  isAdvancing,
  next,
  payment,
  typeIcon,
  typeLabel,
  grandTotal,
  elapsed,
  elapsedClass,
  onSelect,
  onAdvance,
  onPrint,
  onPreview,
  onCancel,
}: OrderCardProps) => {
  const deliveryAddress = order.delivery_address;
  const addressSummary = deliveryAddress ? deliveryAddress.split(",").slice(0, 2).join(",") : null;
  const isClosed = ["delivered", "picked_up", "cancelled"].includes(order.status);

  return (
    <Card
      className="cursor-pointer bg-card hover:shadow-md transition-all border border-border/50 hover:border-border min-h-[180px]"
      onClick={() => onSelect(order)}
    >
      <CardContent className="p-3 space-y-1.5 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-muted-foreground">{order.daily_order_number != null ? `Pedido ${order.daily_order_number}` : `#${order.id.slice(0, 8)}`}</span>
          {showPrepTimer && !isClosed && (
            <Badge className={`text-[10px] px-1.5 py-0 ${elapsedClass}`}>{elapsed}min</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeIcon}
          <span className="text-xs font-medium">{typeLabel}</span>
          {order.ifood_source && (
            <Badge className="bg-[#EA1D2C] text-white text-[10px] px-1.5 py-0 border-0">iFood</Badge>
          )}
          {order.dd_source && (
            <Badge className="bg-[#0066CC] text-white text-[10px] px-1.5 py-0 border-0">Delivery Direto</Badge>
          )}
          {order.dd_scheduled_for && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 border-0 gap-0.5">
              <CalendarClock className="w-2.5 h-2.5" />
              Agendado{" "}
              {new Date(order.dd_scheduled_for).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold truncate">{order.customer_name}</p>
        <div className="text-xs text-muted-foreground">
          {order.order_items.slice(0, 3).map((item, i) => (
            <p key={i} className="truncate">
              {item.quantity}x {item.products?.name || "Produto"}
            </p>
          ))}
          {order.order_items.length > 3 && (
            <p className="text-muted-foreground">+{order.order_items.length - 3} itens</p>
          )}
        </div>
        {addressSummary && order.delivery_type === "delivery" && (
          <p className="text-[10px] text-muted-foreground truncate">📍 {addressSummary}</p>
        )}
        <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${payment.className}`}>
          {payment.icon}
          <span>{payment.label}</span>
        </div>
        {(order.delivery_fee ?? 0) > 0 && (
          <div className="text-[10px] text-muted-foreground">Taxa entrega: R$ {order.delivery_fee!.toFixed(2)}</div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), "HH:mm")}</span>
          <span className="font-bold text-sm">R$ {grandTotal.toFixed(2)}</span>
        </div>
        {next && !isClosed && canManageOrders && (
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/30 mt-auto">
            <Button
              size="sm"
              className="flex-1 h-9 md:h-7 text-sm md:text-xs gap-1"
              disabled={isAdvancing}
              onClick={(e) => onAdvance(e, order)}
            >
              {isAdvancing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {next.label}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 md:h-7 md:w-7 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4 md:w-3.5 md:h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(order);
                  }}
                >
                  <Eye className="w-3.5 h-3.5 mr-2" /> Ver detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => onPrint(e, order)}>
                  <Printer className="w-3.5 h-3.5 mr-2" /> Imprimir
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(order.id);
                  }}
                >
                  <ScrollText className="w-3.5 h-3.5 mr-2" /> Visualizar cupom
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={(e) => onCancel(e, order)}>
                  <XCircle className="w-3.5 h-3.5 mr-2" /> Cancelar pedido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Custom equality: only re-render if order data, advancing state, or perm flags change.
export const OrderCard = memo(OrderCardBase, (prev, next) => {
  if (prev.order !== next.order) return false;
  if (prev.isAdvancing !== next.isAdvancing) return false;
  if (prev.canManageOrders !== next.canManageOrders) return false;
  if (prev.showPrepTimer !== next.showPrepTimer) return false;
  if (prev.elapsed !== next.elapsed) return false;
  if (prev.next?.status !== next.next?.status) return false;
  if (prev.payment.label !== next.payment.label) return false;
  if (prev.grandTotal !== next.grandTotal) return false;
  return true;
});

OrderCard.displayName = "OrderCard";
