import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OrderItemExtra {
  price_at_order: number;
  product_extras: {
    name: string;
  } | null;
}

interface Order {
  id: string;
  customer_name: string;
  status: string;
  created_at: string;
  notes: string | null;
  tables: {
    table_number: number;
  };
  order_items: {
    quantity: number;
    price_at_order: number;
    notes: string | null;
    products: {
      name: string;
    } | null;
    order_item_extras: OrderItemExtra[];
  }[];
}

const OrdersTab = ({ restaurantId }: { restaurantId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchOrders();
    
    // Realtime subscription
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        tables!inner(table_number, restaurant_id),
        order_items(
          quantity,
          price_at_order,
          notes,
          products(name),
          order_item_extras(
            price_at_order,
            product_extras(name)
          )
        )
      `)
      .eq("tables.restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pedidos");
      return;
    }

    setOrders(data || []);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    // UI otimista: atualiza imediatamente na tela
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

    // Atualiza status primeiro (rápido)
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      // Recarrega para desfazer UI otimista se falhar
      fetchOrders();
      return;
    }

    toast.success(newStatus === "accepted" ? "Pedido aceito!" : "Status atualizado!");

    // Processa baixa de estoque em segundo plano para evitar travar o clique
    if (newStatus === "accepted") {
      processStockDeduction(orderId).catch((err) => {
        console.error("Erro ao processar baixa de estoque:", err);
      });
    }

    // Garante consistência com o backend
    fetchOrders();
  };

  const processStockDeduction = async (orderId: string) => {
    try {
      // Buscar os itens do pedido
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", orderId);

      if (itemsError || !orderItems || orderItems.length === 0) {
        console.error("Erro ao buscar itens do pedido:", itemsError);
        return;
      }

      const productIds = Array.from(
        new Set(orderItems.map((i) => i.product_id).filter(Boolean))
      ) as string[];
      if (productIds.length === 0) return;

      // Buscar ingredientes de todos os produtos em uma única chamada
      const { data: ingredients, error: ingredientsError } = await supabase
        .from("product_ingredients")
        .select("product_id, stock_item_id, quantity")
        .in("product_id", productIds);

      if (ingredientsError || !ingredients || ingredients.length === 0) return;

      // Agregar total de baixa por insumo
      const deductions = new Map<string, number>();
      for (const item of orderItems) {
        if (!item.product_id) continue;
        const ingForProduct = ingredients.filter(
          (ing) => ing.product_id === item.product_id
        );
        for (const ing of ingForProduct) {
          const toDeduct = Number(ing.quantity) * Number(item.quantity);
          deductions.set(
            ing.stock_item_id,
            (deductions.get(ing.stock_item_id) || 0) + toDeduct,
          );
        }
      }

      const stockItemIds = Array.from(deductions.keys());
      if (stockItemIds.length === 0) return;

      // Buscar quantidades atuais de todos os insumos de uma vez
      const { data: currentStocks, error: currentError } = await supabase
        .from("stock_items")
        .select("id, current_quantity")
        .in("id", stockItemIds);

      if (currentError || !currentStocks) return;

      // Atualizar insumos em paralelo para reduzir delay
      await Promise.all(
        currentStocks.map((stock) => {
          const deduct = deductions.get(stock.id) || 0;
          const newQty = Math.max(0, Number(stock.current_quantity) - Number(deduct));
          return supabase
            .from("stock_items")
            .update({ current_quantity: newQty })
            .eq("id", stock.id);
        }),
      );

      // Registrar movimentações em uma única inserção
      const movementRows = stockItemIds.map((id) => ({
        stock_item_id: id,
        movement_type: "out",
        quantity: deductions.get(id) || 0,
        reason: `Venda - Pedido ${orderId}`,
        // order_id: orderId, // omitido para evitar erros de FK e atrasos
      }));

      await supabase.from("stock_movements").insert(movementRows);
    } catch (error) {
      console.error("Erro ao processar baixa de estoque:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
      accepted: { label: "Aceito", variant: "default" as const, icon: Check },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pedidos em Tempo Real</h3>

      {orders.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhum pedido ainda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-4 border rounded-lg space-y-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Mesa {order.tables.table_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {order.customer_name}
                  </p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className="space-y-1">
                {order.order_items.map((item, idx) => {
                  const extrasTotal = item.order_item_extras?.reduce((sum, extra) => sum + extra.price_at_order, 0) || 0;
                  const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
                  const productName = item.products?.name || "Produto excluído";
                  
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-sm">
                        <span className={!item.products ? "text-muted-foreground" : ""}>
                          {item.quantity}x {productName}
                        </span>
                        <span className="text-primary font-medium">
                          R$ {itemTotal.toFixed(2)}
                        </span>
                      </div>
                      {item.order_item_extras && item.order_item_extras.length > 0 && (
                        <div className="text-xs text-muted-foreground pl-4">
                          + {item.order_item_extras.map(e => e.product_extras?.name || "Extra excluído").join(', ')}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-xs text-amber-600 pl-4 italic">
                          Obs: {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {order.notes && (
                <div className="text-sm p-2 bg-amber-50 border border-amber-200 rounded">
                  <span className="font-semibold text-amber-800">Observação do Pedido:</span>
                  <p className="text-amber-700 italic">{order.notes}</p>
                </div>
              )}

              {order.status === "pending" && (
                <Button
                  className="w-full"
                  onClick={() => updateOrderStatus(order.id, "accepted")}
                >
                  Aceitar Pedido
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
