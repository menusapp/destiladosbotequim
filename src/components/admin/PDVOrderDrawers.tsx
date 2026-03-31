import { useState, useEffect, useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Truck, Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PDVOrderDrawersProps {
  restaurantId: string;
  prepTimeMinutes: number;
}

export const PDVOrderDrawers = ({ restaurantId, prepTimeMinutes }: PDVOrderDrawersProps) => {
  const [mesaOrders, setMesaOrders] = useState<any[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<any[]>([]);
  const [mesaOpen, setMesaOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [prepTimeEnabled, setPrepTimeEnabled] = useState(() => localStorage.getItem("pdv_prep_time_enabled") !== "false");
  const [resetTimestamps, setResetTimestamps] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  // Tick every 30s to update elapsed times
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(tickRef.current);
  }, []);

  const fetchOrders = async () => {
    const { data: mesa } = await supabase
      .from("orders")
      .select("id, status, created_at, customer_name, table_id, tables(table_number), order_items(id, quantity, products(name))")
      .eq("restaurant_id", restaurantId)
      .eq("order_type", "local")
      .in("status", ["pending", "accepted", "preparing", "ready"])
      .order("created_at", { ascending: false });
    setMesaOrders(mesa || []);

    const { data: online } = await supabase
      .from("orders")
      .select("id, status, created_at, customer_name, delivery_type, order_items(id, quantity, products(name))")
      .eq("restaurant_id", restaurantId)
      .eq("order_type", "delivery")
      .in("status", ["pending", "accepted", "preparing", "ready", "out_for_delivery"])
      .order("created_at", { ascending: false });
    setOnlineOrders(online || []);
  };

  useEffect(() => {
    fetchOrders();
    let debounce: ReturnType<typeof setTimeout>;
    const ch = supabase.channel("pdv-order-drawers")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(fetchOrders, 400);
      })
      .subscribe();
    return () => { clearTimeout(debounce); supabase.removeChannel(ch); };
  }, [restaurantId]);

  const getElapsed = (orderId: string, createdAt: string) => {
    const baseTime = resetTimestamps[orderId] || new Date(createdAt).getTime();
    return Math.floor((Date.now() - baseTime) / 60000);
  };

  const getElapsedColor = (mins: number) => {
    if (prepTimeEnabled && prepTimeMinutes > 0 && mins > prepTimeMinutes) return "text-red-600 bg-red-50 border-red-200";
    if (mins < 5) return "text-green-600 bg-green-50 border-green-200";
    if (mins < 15) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Aguardando", accepted: "Aceito", preparing: "Preparando",
      ready: "Pronto", out_for_delivery: "Saiu",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === "pending") return "bg-orange-100 text-orange-800";
    if (status === "accepted" || status === "preparing") return "bg-blue-100 text-blue-800";
    if (status === "ready") return "bg-green-100 text-green-800";
    return "bg-muted text-muted-foreground";
  };

  const handleResetTimer = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResetTimestamps(prev => ({ ...prev, [orderId]: Date.now() }));
  };

  const handleTogglePrepTime = (enabled: boolean) => {
    setPrepTimeEnabled(enabled);
    localStorage.setItem("pdv_prep_time_enabled", String(enabled));
  };

  const renderOrderCard = (order: any, type: "mesa" | "online") => {
    const elapsed = getElapsed(order.id, order.created_at);
    const itemCount = order.order_items?.length || 0;
    const typeLabel = type === "mesa" ? `Mesa ${order.tables?.table_number || "?"}` : "Online";

    return (
      <Card key={order.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs">
              #{order.id.slice(0, 8)} — {typeLabel}
            </span>
            {prepTimeEnabled && (
              <div className="flex items-center gap-1">
                <Badge className={`text-[10px] px-1.5 py-0 ${getElapsedColor(elapsed)}`}>
                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                  {elapsed}min{prepTimeMinutes > 0 ? `/${prepTimeMinutes}min` : ""}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => handleResetTimer(order.id, e)}
                  title="Zerar tempo"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm font-medium truncate">{order.customer_name}</p>
          <div className="flex items-center justify-between">
            <Badge className={`text-[10px] ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(order.created_at), "HH:mm")} • {itemCount} ite{itemCount !== 1 ? "ns" : "m"}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const mesaPending = mesaOrders.filter(o => o.status === "pending").length;
  const onlinePending = onlineOrders.filter(o => o.status === "pending").length;

  return (
    <div className="fixed bottom-20 left-4 z-40 flex flex-col gap-2">
      {/* Mesa Orders Drawer */}
      <Drawer open={mesaOpen} onOpenChange={setMesaOpen}>
        <DrawerTrigger asChild>
          <Button size="sm" className="gap-1.5 shadow-lg rounded-full px-4" variant={mesaPending > 0 ? "default" : "outline"}>
            <UtensilsCrossed className="w-4 h-4" />
            Mesa ({mesaOrders.length})
            {mesaPending > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1 animate-pulse">{mesaPending}</Badge>}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerTitle>Pedidos de Mesa ({mesaOrders.length})</DrawerTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="prep-toggle" className="text-xs">Tempo preparo</Label>
                <Switch id="prep-toggle" checked={prepTimeEnabled} onCheckedChange={handleTogglePrepTime} />
              </div>
            </div>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 pb-6" style={{ maxHeight: "55vh" }}>
            <div className="space-y-2">
              {mesaOrders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum pedido de mesa ativo</p>
              ) : mesaOrders.map(o => renderOrderCard(o, "mesa"))}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Online Orders Drawer */}
      <Drawer open={onlineOpen} onOpenChange={setOnlineOpen}>
        <DrawerTrigger asChild>
          <Button size="sm" className="gap-1.5 shadow-lg rounded-full px-4" variant={onlinePending > 0 ? "default" : "outline"}>
            <Truck className="w-4 h-4" />
            Online ({onlineOrders.length})
            {onlinePending > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1 animate-pulse">{onlinePending}</Badge>}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader>
            <DrawerTitle>Pedidos Online ({onlineOrders.length})</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 pb-6" style={{ maxHeight: "55vh" }}>
            <div className="space-y-2">
              {onlineOrders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum pedido online ativo</p>
              ) : onlineOrders.map(o => renderOrderCard(o, "online"))}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
