import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Users, DollarSign, ShoppingBag, Clock, Check, ChefHat, PackageCheck, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comanda {
  id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
  created_at: string;
  order_count?: number;
}

interface OrderItemExtra {
  price_at_order: number;
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

interface Order {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  notes?: string;
  comanda_id?: string;
  order_items: OrderItem[];
}

export const TableDetailView = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [tableNumber, setTableNumber] = useState<number>(0);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string>("");

  useEffect(() => {
    if (tableId) {
      fetchTableData();
      setupRealtime();
    }
  }, [tableId]);

  const setupRealtime = () => {
    const comandasChannel = supabase
      .channel(`comandas-${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas', filter: `table_id=eq.${tableId}` },
        () => fetchTableData()
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(`orders-${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${tableId}` },
        () => fetchTableData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(comandasChannel);
      supabase.removeChannel(ordersChannel);
    };
  };

  const fetchTableData = async () => {
    if (!tableId) return;

    try {
      // Buscar informações da mesa
      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .select("table_number, restaurant_id")
        .eq("id", tableId)
        .single();

      if (tableError) throw tableError;
      if (tableData) {
        setTableNumber(tableData.table_number);
        setRestaurantId(tableData.restaurant_id);
      }

      // Buscar comandas ativas da mesa
      const { data: comandasData, error: comandasError } = await supabase
        .from("comandas")
        .select("*")
        .eq("table_id", tableId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (comandasError) throw comandasError;

      // Extrair IDs das comandas ativas
      const activeComandaIds = (comandasData || []).map(c => c.id);

      // Contar pedidos de cada comanda
      if (comandasData) {
        const comandasWithCount = await Promise.all(
          comandasData.map(async (comanda) => {
            const { count } = await supabase
              .from("orders")
              .select("*", { count: "exact", head: true })
              .eq("comanda_id", comanda.id)
              .in("status", ["pending", "accepted", "preparing", "ready"]);
            return { ...comanda, order_count: count || 0 };
          })
        );
        setComandas(comandasWithCount);
      }

      // Buscar pedidos APENAS das comandas ativas
      // Se não houver comandas ativas, não mostrar nenhum pedido
      if (activeComandaIds.length === 0) {
        setOrders([]);
      } else {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select(`
            id,
            status,
            created_at,
            customer_name,
            notes,
            comanda_id,
            order_items (
              id,
              quantity,
              price_at_order,
              notes,
              products (name),
              order_item_extras (
                price_at_order,
                product_extras (name)
              )
            )
          `)
          .eq("table_id", tableId)
          .in("comanda_id", activeComandaIds)
          .in("status", ["pending", "accepted", "preparing", "ready"])
          .order("created_at", { ascending: false });

        if (ordersError) throw ordersError;
        setOrders(ordersData || []);
      }
    } catch (error) {
      console.error("Erro ao buscar dados da mesa:", error);
      toast.error("Erro ao carregar dados da mesa");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return orders.reduce((sum, order) => {
      const orderSum = order.order_items.reduce((itemSum, item) => {
        const extrasSum = item.order_item_extras.reduce((s, e) => s + e.price_at_order, 0);
        return itemSum + (item.price_at_order + extrasSum) * item.quantity;
      }, 0);
      return sum + orderSum;
    }, 0);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase.rpc("admin_update_order_status", {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;
      toast.success("Status atualizado!");
      fetchTableData();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;

    try {
      const { error } = await supabase.rpc("admin_delete_order", {
        p_order_id: orderId,
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;
      toast.success("Pedido excluído!");
      fetchTableData();
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      toast.error("Erro ao excluir pedido");
    }
  };

  const printOrder = (order: Order) => {
    const printContent = `
      PEDIDO #${order.id.slice(0, 8)}
      Mesa ${tableNumber}
      Cliente: ${order.customer_name}
      ${new Date(order.created_at).toLocaleString("pt-BR")}
      
      ${order.order_items.map(item => `
        ${item.quantity}x ${item.products?.name || "Produto"}
        ${item.order_item_extras.map(e => `  + ${e.product_extras?.name || "Extra"}`).join("\n")}
        ${item.notes ? `  Obs: ${item.notes}` : ""}
      `).join("\n")}
      
      ${order.notes ? `Observações: ${order.notes}` : ""}
    `;

    const printWindow = window.open("", "", "width=300,height=600");
    if (printWindow) {
      printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${printContent}</pre>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Pendente", icon: Clock, variant: "secondary" as const },
      accepted: { label: "Aceito", icon: Check, variant: "default" as const },
      preparing: { label: "Preparando", icon: ChefHat, variant: "default" as const },
      ready: { label: "Pronto", icon: PackageCheck, variant: "default" as const },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Mesa {tableNumber}</h1>
          </div>
        </div>
        <Button onClick={() => navigate(`/admin#pdv-mesas?table=${tableId}`)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Pedido
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda - Info */}
        <div className="space-y-6">
          {/* Comandas Vinculadas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comandas Vinculadas</CardTitle>
            </CardHeader>
            <CardContent>
              {comandas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma comanda ativa</p>
              ) : (
                <div className="space-y-3">
                  {comandas.map((comanda) => (
                    <div key={comanda.id} className="p-3 bg-muted rounded-lg space-y-1">
                      <p className="font-medium">{comanda.customer_name}</p>
                      <p className="text-sm text-muted-foreground">CPF: {comanda.customer_cpf}</p>
                      <p className="text-xs text-muted-foreground">
                        {comanda.order_count} pedido(s) ativos
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Pedidos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Consumo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ {calculateTotal().toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Pedidos */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Pedidos em Andamento
                  <Badge variant="secondary">{orders.length}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum pedido em andamento</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="font-medium">Pedido #{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(order.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>

                        <div className="space-y-2 mb-4">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="text-sm">
                              <p>
                                {item.quantity}x {item.products?.name || "Produto"}
                              </p>
                              {item.order_item_extras.map((extra, idx) => (
                                <p key={idx} className="text-muted-foreground ml-4">
                                  + {extra.product_extras?.name || "Extra"}
                                </p>
                              ))}
                              {item.notes && (
                                <p className="text-muted-foreground ml-4 italic">Obs: {item.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => updateOrderStatus(order.id, "accepted")}
                            >
                              Aceitar
                            </Button>
                          )}
                          {order.status === "accepted" && (
                            <Button
                              size="sm"
                              onClick={() => updateOrderStatus(order.id, "preparing")}
                            >
                              Preparando
                            </Button>
                          )}
                          {order.status === "preparing" && (
                            <Button
                              size="sm"
                              onClick={() => updateOrderStatus(order.id, "ready")}
                            >
                              Pronto
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printOrder(order)}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteOrder(order.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
