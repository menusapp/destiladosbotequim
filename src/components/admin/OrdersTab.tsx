import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Check, Printer, Search, Trash2, Calendar, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { startOfDay, endOfDay, format } from "date-fns";
import { pt } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface OrderItemExtra {
  price_at_order: number;
  product_extras: {
    name: string;
  } | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
  created_at: string;
  notes: string | null;
  order_type?: string;
  delivery_phone?: string;
  delivery_address?: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Manual order states
  const [tables, setTables] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [manualOrder, setManualOrder] = useState({
    tableId: "",
    customerName: "",
    customerCPF: "",
    selectedProducts: [] as { productId: string; quantity: number; price: number; name: string }[],
  });

  useEffect(() => {
    fetchOrders();
    fetchTables();
    fetchProducts();

    // Realtime subscription
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => fetchOrders(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, startDate, endDate]);

  const fetchTables = async () => {
    const { data } = await supabase.from("tables").select("*").eq("restaurant_id", restaurantId).order("table_number");

    setTables(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, categories!inner(restaurant_id)")
      .eq("categories.restaurant_id", restaurantId)
      .eq("available", true)
      .order("name");

    setProducts(data || []);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
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
      `,
      )
      .eq("tables.restaurant_id", restaurantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
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

    // Atualiza status via função segura (bypassa RLS)
    const { error } = await (supabase as any).rpc("admin_update_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao atualizar status");
      // Recarrega para desfazer UI otimista se falhar
      fetchOrders();
      return;
    }

    toast.success(newStatus === "accepted" ? "Pedido aceito!" : "Status atualizado!");

    // Trigger process_order_stock_movement dá baixa automática no estoque
    // Trigger add_order_to_cash registra automaticamente no caixa

    // Garante consistência com o backend
    fetchOrders();
  };
  const deleteOrder = async (orderId: string) => {
    const { error } = await (supabase as any).rpc("admin_delete_order_and_bill", {
      p_order_id: orderId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao excluir pedido");
      console.error(error);
      return;
    }

    toast.success("Pedido e conta excluídos!");
    fetchOrders();
  };

  const handleAddProductToManualOrder = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const existing = manualOrder.selectedProducts.find((p) => p.productId === productId);
    if (existing) {
      setManualOrder({
        ...manualOrder,
        selectedProducts: manualOrder.selectedProducts.map((p) =>
          p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p,
        ),
      });
    } else {
      setManualOrder({
        ...manualOrder,
        selectedProducts: [
          ...manualOrder.selectedProducts,
          {
            productId: product.id,
            quantity: 1,
            price: product.price,
            name: product.name,
          },
        ],
      });
    }
  };

  const handleRemoveProductFromManualOrder = (productId: string) => {
    setManualOrder({
      ...manualOrder,
      selectedProducts: manualOrder.selectedProducts.filter((p) => p.productId !== productId),
    });
  };

  const handleUpdateProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveProductFromManualOrder(productId);
      return;
    }
    setManualOrder({
      ...manualOrder,
      selectedProducts: manualOrder.selectedProducts.map((p) => (p.productId === productId ? { ...p, quantity } : p)),
    });
  };

  const handleCreateManualOrder = async () => {
    if (
      !manualOrder.tableId ||
      !manualOrder.customerName ||
      !manualOrder.customerCPF ||
      manualOrder.selectedProducts.length === 0
    ) {
      toast.error("Preencha todos os campos e adicione pelo menos um produto");
      return;
    }

    try {
      // Check if cash register is open (para feedback ao usuário)
      const { data: cashSession } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .maybeSingle();

      if (!cashSession) {
        toast.error("Abra o caixa primeiro para registrar pedidos manuais");
        return;
      }

      // Get restaurant_id from the table
      const { data: tableData } = await supabase
        .from("tables")
        .select("restaurant_id")
        .eq("id", manualOrder.tableId)
        .single();

      if (!tableData) {
        throw new Error("Mesa não encontrada");
      }

      // Create order with status='pending' first
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: manualOrder.tableId,
          restaurant_id: tableData.restaurant_id,
          customer_name: manualOrder.customerName,
          customer_cpf: manualOrder.customerCPF,
          status: "pending",
          notes: "Pedido Manual",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = manualOrder.selectedProducts.map((p) => ({
        order_id: order.id,
        product_id: p.productId,
        quantity: p.quantity,
        price_at_order: p.price,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

      if (itemsError) throw itemsError;

      // Now update status to 'accepted' to trigger cash register and stock
      const { error: updateError } = await supabase.from("orders").update({ status: "accepted" }).eq("id", order.id);

      if (updateError) throw updateError;

      toast.success("Pedido manual criado!");
      setManualOrder({
        tableId: "",
        customerName: "",
        customerCPF: "",
        selectedProducts: [],
      });
      fetchOrders();
    } catch (error) {
      console.error("Error creating manual order:", error);
      toast.error("Erro ao criar pedido manual");
    }
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open("", "", "height=600,width=400");
    if (!printWindow) return;

    const isDelivery = order.order_type === "delivery" || order.tables.table_number === 9999;

    const orderItems = order.order_items
      .map((item, idx) => {
        const extrasTotal = item.order_item_extras?.reduce((sum, extra) => sum + extra.price_at_order, 0) || 0;
        const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
        const productName = item.products?.name || "Produto excluído";
        const extras =
          item.order_item_extras && item.order_item_extras.length > 0
            ? `<div style="font-size: 11px; padding-left: 20px; margin-top: 2px;">+ ${item.order_item_extras.map((e) => e.product_extras?.name || "Extra excluído").join(", ")}</div>`
            : "";
        const notes = item.notes
          ? `<div style="font-size: 11px; padding-left: 20px; margin-top: 2px; font-style: italic; color: #b45309;">Obs: ${item.notes}</div>`
          : "";

        return `
        <div style="margin: 8px 0; border-bottom: 1px dashed #ddd; padding-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span><strong>${item.quantity}x</strong> ${productName}</span>
            <span>R$ ${itemTotal.toFixed(2)}</span>
          </div>
          ${extras}
          ${notes}
        </div>
      `;
      })
      .join("");

    const orderNotes = order.notes
      ? `<div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 10px; margin: 10px 0; border-radius: 4px;">
           <strong style="color: #92400e;">Observação do Pedido:</strong>
           <div style="color: #78350f; font-style: italic; margin-top: 4px;">${order.notes}</div>
         </div>`
      : "";

    const deliveryInfo = isDelivery 
      ? `<div style="background: #dbeafe; border: 1px solid #3b82f6; padding: 10px; margin: 10px 0; border-radius: 4px;">
           <strong style="color: #1e40af;">🚚 DELIVERY</strong>
           <div style="margin-top: 5px; font-size: 12px;">
             <div><strong>Cliente:</strong> ${order.customer_name}</div>
             ${order.customer_cpf ? `<div><strong>CPF:</strong> ${order.customer_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>` : ''}
             ${order.delivery_phone ? `<div><strong>Telefone:</strong> ${order.delivery_phone}</div>` : ''}
             ${order.delivery_address ? `<div style="margin-top: 5px;"><strong>Endereço:</strong><br/>${order.delivery_address}</div>` : ''}
           </div>
         </div>`
      : `<div style="font-size: 12px; margin-top: 5px;">Cliente: ${order.customer_name}</div>
         ${order.customer_cpf ? `<div style="font-size: 11px; margin-top: 2px;">CPF: ${order.customer_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>` : ''}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido ${isDelivery ? 'Delivery' : 'Mesa ' + order.tables.table_number}</title>
          <style>
            @media print {
              @page { margin: 10mm; }
              body { margin: 0; }
            }
            body {
              font-family: 'Courier New', monospace;
              max-width: 300px;
              margin: 0 auto;
              padding: 15px;
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            <h2 style="margin: 5px 0;">PEDIDO - COZINHA</h2>
            <div style="font-size: 16px; font-weight: bold; margin-top: 8px;">
              ${isDelivery ? '🚚 DELIVERY' : 'MESA ' + order.tables.table_number}
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 5px;">${new Date(order.created_at).toLocaleString("pt-BR")}</div>
          </div>
          
          ${deliveryInfo}

          <div style="margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #000; padding-bottom: 5px;">ITENS</h3>
            ${orderItems}
          </div>

          ${orderNotes}

          <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 2px solid #000; font-size: 11px;">
            <p style="margin: 5px 0;">Pedido: ${order.id.slice(0, 8)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
    <div className="flex flex-col h-full space-y-4">
      {/* Seção de criar pedido manual removida - usar aba Balcão */}

      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Pedidos em Tempo Real</h3>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                {format(startDate, "dd/MM/yy", { locale: pt })} - {format(endDate, "dd/MM/yy", { locale: pt })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data inicial</label>
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(startOfDay(date))}
                    locale={pt}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data final</label>
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(endOfDay(date))}
                    locale={pt}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por mesa ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhum pedido neste período</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {orders
            .filter((order) => {
              const searchLower = debouncedSearch.toLowerCase();
              return (
                order.tables.table_number.toString().includes(searchLower) ||
                order.customer_name.toLowerCase().includes(searchLower)
              );
            })
            .map((order) => (
              <div key={order.id} className="p-4 border rounded-lg space-y-3 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {order.order_type === "delivery" || order.tables.table_number === 9999 
                        ? "🚚 Delivery" 
                        : `Mesa ${order.tables.table_number}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cliente: {order.customer_name}
                      {order.customer_cpf && (
                        <span className="ml-1">- CPF: {order.customer_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                      )}
                    </p>
                    {(order.order_type === "delivery" || order.tables.table_number === 9999) && order.delivery_address && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 {order.delivery_address}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="space-y-1">
                  {order.order_items.map((item, idx) => {
                    const extrasTotal =
                      item.order_item_extras?.reduce((sum, extra) => sum + extra.price_at_order, 0) || 0;
                    const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
                    const productName = item.products?.name || "Produto excluído";

                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-sm">
                          <span className={!item.products ? "text-muted-foreground" : ""}>
                            {item.quantity}x {productName}
                          </span>
                          <span className="text-primary font-medium">R$ {itemTotal.toFixed(2)}</span>
                        </div>
                        {item.order_item_extras && item.order_item_extras.length > 0 && (
                          <div className="pl-4 space-y-0.5">
                            {item.order_item_extras.map((extra, extraIdx) => (
                              <div key={extraIdx} className="text-xs flex justify-between">
                                <span className="text-orange-600 font-medium">
                                  + {extra.product_extras?.name || "Extra excluído"}
                                </span>
                                <span className="text-orange-600">
                                  R$ {extra.price_at_order.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.notes && <div className="text-xs text-amber-600 pl-4 italic">Obs: {item.notes}</div>}
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

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => printOrder(order)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  {order.status === "pending" && (
                    <Button className="flex-1" size="sm" onClick={() => updateOrderStatus(order.id, "accepted")}>
                      Aceitar Pedido
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteOrder(order.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
