import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, Check, UtensilsCrossed } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TableData {
  id: string;
  table_number: number;
  table_name: string | null;
  is_occupied: boolean;
  occupied_by: string | null;
  occupied_at: string | null;
  comandas?: { id: string; customer_name: string; customer_cpf: string }[];
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  notes?: string;
  products: { name: string } | null;
  order_item_extras: { price_at_order: number; product_extras: { name: string } | null }[];
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  customer_cpf: string;
  delivery_type?: string;
  order_type?: string;
  delivery_address?: string;
  delivery_phone?: string;
  notes?: string;
  payment_type?: string;
  table_id?: string;
  tables?: { table_number: number };
  order_items: OrderItem[];
}

interface TableOrdersDrawerProps {
  restaurantId: string;
  table: TableData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewOrder: (order: Order) => void;
}

export const TableOrdersDrawer = ({ restaurantId, table, open, onOpenChange, onViewOrder }: TableOrdersDrawerProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) fetchTableOrders();
  }, [open, table.id]);

  const fetchTableOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select(`id, status, created_at, customer_name, customer_cpf, delivery_type, order_type, delivery_address, delivery_phone, notes, payment_type, table_id, tables(table_number), order_items(id, quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
      .eq("table_id", table.id)
      .in("status", ["pending", "accepted", "preparing", "ready", "delivered"])
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const calculateTotal = (order: Order) => {
    return order.order_items.reduce((total, item) => {
      const extrasTotal = item.order_item_extras.reduce((s, e) => s + e.price_at_order, 0) * item.quantity;
      return total + item.price_at_order * item.quantity + extrasTotal;
    }, 0);
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "Aguardando", accepted: "Em preparo", preparing: "Preparando",
      ready: "Pronto", delivered: "Entregue",
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === "pending") return "bg-amber-100 text-amber-800";
    if (["accepted", "preparing"].includes(status)) return "bg-blue-100 text-blue-800";
    if (status === "ready") return "bg-purple-100 text-purple-800";
    return "bg-green-100 text-green-800";
  };

  const tableTotal = orders.reduce((sum, o) => sum + calculateTotal(o), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
              table.is_occupied ? "bg-green-500" : "bg-muted-foreground/40"
            }`}>
              {table.table_number}
            </div>
            {table.table_name || `Mesa ${table.table_number}`}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{table.comandas?.length || 0} comanda{(table.comandas?.length || 0) !== 1 ? "s" : ""}</span>
            </div>
            {table.is_occupied && table.occupied_at && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Desde {format(new Date(table.occupied_at), "HH:mm")}</span>
              </div>
            )}
          </div>

          {/* Comandas */}
          {table.comandas && table.comandas.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Clientes ativos</h4>
              {table.comandas.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-lg">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{c.customer_name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Orders */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Pedidos ({orders.length})</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido ativo</p>
            ) : (
              orders.map(order => {
                const total = calculateTotal(order);
                return (
                  <Card key={order.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => onViewOrder(order)}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">#{order.id.slice(0, 8)}</span>
                        <Badge className={`text-[10px] ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{order.customer_name}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {order.order_items.slice(0, 3).map((item, i) => (
                          <p key={i}>{item.quantity}x {item.products?.name || "Produto"}</p>
                        ))}
                        {order.order_items.length > 3 && <p>+{order.order_items.length - 3} itens</p>}
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                        <span className="text-muted-foreground">{format(new Date(order.created_at), "HH:mm")}</span>
                        <span className="font-bold">R$ {total.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Total */}
          {orders.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg font-bold text-sm">
              <span>Total da mesa</span>
              <span>R$ {tableTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
