import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useStatusBadge } from "@/hooks/useStatusBadge";

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
  const { getOrderStatusBadge } = useStatusBadge();

  const fetchOrders = useCallback(async () => {
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
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useRealtimeSubscription({
    table: 'orders',
    callback: fetchOrders,
  });

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    // Se está aceitando o pedido, dar baixa no estoque
    if (newStatus === "accepted") {
      await processStockDeduction(orderId);
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success(newStatus === "accepted" ? "Pedido aceito e estoque atualizado!" : "Status atualizado!");
    fetchOrders();
  };

  const processStockDeduction = async (orderId: string) => {
    try {
      // Buscar os itens do pedido
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id, product_id, quantity")
        .eq("order_id", orderId);

      if (itemsError || !orderItems) {
        console.error("Erro ao buscar itens do pedido:", itemsError);
        return;
      }

      // Processar cada item do pedido
      for (const item of orderItems) {
        // Buscar os ingredientes do produto
        const { data: ingredients, error: ingredientsError } = await supabase
          .from("product_ingredients")
          .select("stock_item_id, quantity")
          .eq("product_id", item.product_id);

        if (ingredientsError || !ingredients) continue;

        // Dar baixa em cada ingrediente
        for (const ingredient of ingredients) {
          const totalQuantityToDeduct = ingredient.quantity * item.quantity;

          // Buscar quantidade atual
          const { data: currentStock } = await supabase
            .from("stock_items")
            .select("current_quantity")
            .eq("id", ingredient.stock_item_id)
            .maybeSingle();

          if (currentStock) {
            // Atualizar quantidade
            await supabase
              .from("stock_items")
              .update({ 
                current_quantity: Math.max(0, currentStock.current_quantity - totalQuantityToDeduct)
              })
              .eq("id", ingredient.stock_item_id);

            // Registrar movimentação
            await supabase
              .from("stock_movements")
              .insert({
                stock_item_id: ingredient.stock_item_id,
                movement_type: "out",
                quantity: totalQuantityToDeduct,
                reason: `Venda - Pedido ${orderId}`,
                order_id: orderId
              });
          }
        }
      }
    } catch (error) {
      console.error("Erro ao processar baixa de estoque:", error);
    }
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
                {getOrderStatusBadge(order.status)}
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
