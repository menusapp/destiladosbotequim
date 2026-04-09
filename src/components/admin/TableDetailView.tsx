import { useEffect, useState } from "react";
import { formatPaymentMethod } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { printOrder as printOrderThermal } from "@/lib/printOrder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  Check, 
  ChefHat, 
  PackageCheck, 
  Printer, 
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ComandaWithDetails {
  id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
  created_at: string;
  order_count: number;
  total: number;
  orders: Order[];
}

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

interface Order {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  notes?: string;
  comanda_id?: string;
  payment_type?: string;
  coupon_discount?: number;
  order_items: OrderItem[];
}

export const TableDetailView = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [tableNumber, setTableNumber] = useState<number>(0);
  const [comandas, setComandas] = useState<ComandaWithDetails[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [expandedComandas, setExpandedComandas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (tableId) {
      fetchTableData();
      const cleanup = setupRealtime();
      return cleanup;
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
        .order("created_at", { ascending: true });

      if (comandasError) throw comandasError;

      const activeComandaIds = (comandasData || []).map(c => c.id);

      // Buscar todos os pedidos das comandas ativas
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          created_at,
          customer_name,
          notes,
          comanda_id,
          payment_type,
          coupon_discount,
          order_items (
            id,
            quantity,
            price_at_order,
            notes,
            products (name),
            order_item_extras (
              price_at_order,
              extra_name,
              product_extras (name)
            )
          )
        `)
        .eq("table_id", tableId)
        .in("status", ["pending", "accepted", "preparing", "ready", "delivered"])
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Filtrar pedidos vinculados a comandas ativas
      const filteredOrders = (ordersData || []).filter(order => 
        order.comanda_id && activeComandaIds.includes(order.comanda_id)
      );

      setAllOrders(filteredOrders);

      // Calcular detalhes de cada comanda
      const comandasWithDetails: ComandaWithDetails[] = (comandasData || []).map(comanda => {
        const comandaOrders = filteredOrders.filter(o => o.comanda_id === comanda.id);
        const total = comandaOrders.reduce((sum, order) => {
          const itemsTotal = order.order_items.reduce((itemSum, item) => {
            const extrasSum = item.order_item_extras.reduce((s, e) => s + e.price_at_order, 0);
            return itemSum + (item.price_at_order + extrasSum) * item.quantity;
          }, 0);
          return sum + itemsTotal - (order.coupon_discount || 0);
        }, 0);

        return {
          ...comanda,
          order_count: comandaOrders.length,
          total,
          orders: comandaOrders
        };
      });

      setComandas(comandasWithDetails);

    } catch (error) {
      console.error("Erro ao buscar dados da mesa:", error);
      toast.error("Erro ao carregar dados da mesa");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return comandas.reduce((sum, comanda) => sum + comanda.total, 0);
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

      // Mark table as occupied when accepting a table order
      if (newStatus === "accepted") {
        await supabase.from("tables").update({
          is_occupied: true,
          occupied_at: new Date().toISOString(),
          occupied_by: allOrders.find(o => o.id === orderId)?.customer_name || "Cliente",
        }).eq("id", tableId);

        // Auto-print on accept if enabled
        const autoPrintEnabled = localStorage.getItem("pdv_auto_print") === "true";
        if (autoPrintEnabled) {
          const order = allOrders.find(o => o.id === orderId);
          if (order) {
            try {
              await printOrderForThermal(order);
            } catch { /* ignore print errors */ }
          }
        }
      }

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

  const printOrderForThermal = async (order: Order) => {
    const thermalOrder = {
      id: order.id,
      created_at: order.created_at,
      customer_name: order.customer_name,
      order_type: "local" as const,
      tables: { table_number: tableNumber },
      notes: order.notes,
      order_items: order.order_items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        price_at_order: item.price_at_order,
        notes: item.notes,
        products: item.products,
        order_item_extras: item.order_item_extras.map(e => ({
          price_at_order: e.price_at_order,
          extra_name: e.extra_name,
          product_extras: e.product_extras,
        })),
      })),
    };
    await printOrderThermal(thermalOrder, restaurantId);
  };

  const printOrder = async (order: Order) => {
    try {
      await printOrderForThermal(order);
    } catch (err) {
      console.error("Erro ao imprimir:", err);
      toast.error("Erro ao imprimir pedido");
    }
  };




  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Pendente", icon: Clock, variant: "secondary" as const },
      accepted: { label: "Aceito", icon: Check, variant: "default" as const },
      preparing: { label: "Preparando", icon: ChefHat, variant: "default" as const },
      ready: { label: "Pronto", icon: PackageCheck, variant: "default" as const },
      delivered: { label: "Entregue", icon: PackageCheck, variant: "default" as const },
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

  const maskCPF = (cpf: string) => {
    if (cpf.length === 11) {
      return `***.***${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    }
    return cpf;
  };

  const toggleComanda = (comandaId: string) => {
    setExpandedComandas(prev => {
      const next = new Set(prev);
      if (next.has(comandaId)) {
        next.delete(comandaId);
      } else {
        next.add(comandaId);
      }
      return next;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mesa {tableNumber}</h1>
              <p className="text-sm text-muted-foreground">
                {comandas.length} cliente{comandas.length !== 1 ? 's' : ''} ativo{comandas.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => { const slug = localStorage.getItem("restaurant_slug") || ""; navigate(`/${slug}/admin#pdv-mesas?table=${tableId}`); }}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Pedido
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">{comandas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Ativos</p>
                <p className="text-2xl font-bold">{allOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Consumo Total</p>
                <p className="text-2xl font-bold">R$ {calculateTotal().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comandas Vinculadas */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Comandas Vinculadas
              <Badge variant="secondary">{comandas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comandas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma comanda ativa nesta mesa
              </p>
            ) : (
              <div className="space-y-3">
                {comandas.map((comanda) => (
                  <Collapsible
                    key={comanda.id}
                    open={expandedComandas.has(comanda.id)}
                    onOpenChange={() => toggleComanda(comanda.id)}
                  >
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer">
                          <div className="flex-1">
                            <p className="font-semibold">{comanda.customer_name}</p>
                            <p className="text-sm text-muted-foreground">
                              CPF: {maskCPF(comanda.customer_cpf)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge variant="secondary" className="mb-1">
                                {comanda.order_count} pedido{comanda.order_count !== 1 ? 's' : ''}
                              </Badge>
                              <p className="text-sm font-medium">
                                R$ {comanda.total.toFixed(2)}
                              </p>
                            </div>
                            {expandedComandas.has(comanda.id) ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        {comanda.orders.length > 0 && (
                          <div className="mt-4 pt-4 border-t space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              Itens pedidos
                            </p>
                            {comanda.orders.map((order) => (
                              <div key={order.id} className="text-sm space-y-1">
                                {order.payment_type && (
                                  <Badge variant="outline" className="text-[10px] mb-1 border-green-500 text-green-700 dark:text-green-400">
                                    Pago - {formatPaymentMethod(order.payment_type)}
                                  </Badge>
                                )}
                                {order.order_items.map((item) => (
                                  <div key={item.id}>
                                    <div className="flex justify-between">
                                      <span>
                                        {item.quantity}x {item.products?.name || "Produto"}
                                      </span>
                                      <span className="text-muted-foreground">
                                        R$ {(item.price_at_order * item.quantity).toFixed(2)}
                                      </span>
                                    </div>
                                    {item.notes && (
                                      <p className="text-sm text-muted-foreground italic ml-4">
                                        Obs: {item.notes}
                                      </p>
                                    )}
                                    {item.order_item_extras.map((extra, idx) => (
                                      <p key={idx} className="text-sm text-muted-foreground ml-4">
                                        + {extra.extra_name || extra.product_extras?.name || "Extra"} (R$ {extra.price_at_order.toFixed(2)})
                                      </p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pedidos em Andamento */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Pedidos em Andamento
              <Badge variant="secondary">{allOrders.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {allOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum pedido em andamento
              </p>
            ) : (
              <div className="space-y-4">
                {allOrders.map((order) => (
                  <div key={order.id} className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-start justify-between mb-3">
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

                    <div className="space-y-1 mb-4">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="text-sm">
                          <p>
                            {item.quantity}x {item.products?.name || "Produto"}
                          </p>
                          {item.order_item_extras.map((extra, idx) => (
                            <p key={idx} className="text-muted-foreground ml-4">
                              + {extra.extra_name || extra.product_extras?.name || "Extra"}
                            </p>
                          ))}
                          {item.notes && (
                            <p className="text-muted-foreground ml-4 italic">
                              Obs: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
