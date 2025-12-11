import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Users,
  ShoppingCart,
  DollarSign,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import BalcaoTab from "./BalcaoTab";

interface PDVTabProps {
  restaurantId: string;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: { extraId: string; name: string; price: number }[];
}

interface Table {
  id: string;
  table_number: number;
  is_occupied: boolean;
  occupied_by: string | null;
  occupied_at: string | null;
}

const PDVTab = ({ restaurantId }: PDVTabProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("balcao");
  
  // Mesas state
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showTableDetail, setShowTableDetail] = useState(false);
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [tableComandas, setTableComandas] = useState<any[]>([]);
  const [showPayBillDialog, setShowPayBillDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Split payment state
  const [splitPayments, setSplitPayments] = useState<{method: string; amount: number; receivedAmount?: number}[]>([]);
  
  // Criar comanda manual state
  const [newComandaName, setNewComandaName] = useState("");
  const [newComandaCpf, setNewComandaCpf] = useState("");
  
  // Adicionar produtos à mesa state
  const [showAddProductsDialog, setShowAddProductsDialog] = useState(false);
  const [tableCart, setTableCart] = useState<CartItem[]>([]);
  const [tableOrderNotes, setTableOrderNotes] = useState("");

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["pdv-categories", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["pdv-products", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, price, image_url, category_id, available,
          categories!inner(restaurant_id),
          product_extras(id, name, price)
        `)
        .eq("categories.restaurant_id", restaurantId)
        .eq("available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch tables
  const { data: tables, refetch: refetchTables } = useQuery({
    queryKey: ["pdv-tables", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .neq("table_number", 9999)
        .order("table_number");
      if (error) throw error;
      return data as Table[];
    },
  });

  // Setup realtime for tables
  useEffect(() => {
    const channel = supabase
      .channel("pdv-tables-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        refetchTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchTables]);

  // Filter products
  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Fetch table details
  const fetchTableDetails = async (table: Table) => {
    setSelectedTable(table);
    setShowTableDetail(true);

    try {
      const { data: comandasData } = await supabase
        .from("comandas")
        .select("*")
        .eq("table_id", table.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      setTableComandas(comandasData || []);

      const activeComandaIds = (comandasData || []).map((c) => c.id);

      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          id, status, created_at, customer_name, notes, comanda_id,
          order_items (
            id, quantity, price_at_order, notes,
            products (name),
            order_item_extras (price_at_order, product_extras (name))
          )
        `)
        .eq("table_id", table.id)
        .in("status", ["pending", "accepted", "preparing", "ready"])
        .order("created_at", { ascending: false });

      const filteredOrders = (ordersData || []).filter(
        (order) => order.comanda_id && activeComandaIds.includes(order.comanda_id)
      );

      setTableOrders(filteredOrders);
    } catch (error) {
      console.error("Error fetching table details:", error);
      toast.error("Erro ao carregar dados da mesa");
    }
  };

  // Calculate table total
  const calculateTableTotal = () => {
    return tableOrders.reduce((sum, order) => {
      const orderSum = order.order_items.reduce((itemSum: number, item: any) => {
        const extrasSum = item.order_item_extras?.reduce((s: number, e: any) => s + e.price_at_order, 0) || 0;
        return itemSum + (item.price_at_order + extrasSum) * item.quantity;
      }, 0);
      return sum + orderSum;
    }, 0);
  };

  // Split payment helpers
  const getTotalSplitPayments = () => splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const getRemainingAmount = () => calculateTableTotal() - getTotalSplitPayments();
  const getChangeAmount = () => {
    const cashPayment = splitPayments.find(p => p.method === "cash");
    return cashPayment?.receivedAmount ? cashPayment.receivedAmount - cashPayment.amount : 0;
  };

  const addSplitPayment = (method: string) => {
    const remaining = getRemainingAmount();
    if (remaining <= 0) {
      toast.error("Valor total já atingido");
      return;
    }
    setSplitPayments(prev => [...prev, { method, amount: remaining }]);
  };

  const updateSplitPaymentAmount = (index: number, amount: number) => {
    setSplitPayments(prev => prev.map((p, i) => i === index ? { ...p, amount: Math.max(0, amount) } : p));
  };

  const updateCashReceivedAmount = (index: number, receivedAmount: number) => {
    setSplitPayments(prev => prev.map((p, i) => i === index ? { ...p, receivedAmount } : p));
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  };

  const openPayBillDialog = () => {
    setSplitPayments([]);
    setShowPayBillDialog(true);
  };

  // Pay table bill mutation
  const payBillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error("Mesa não selecionada");
      if (splitPayments.length === 0) throw new Error("Adicione pelo menos uma forma de pagamento");
      
      const total = calculateTableTotal();
      const totalPaid = getTotalSplitPayments();
      
      if (totalPaid < total) {
        throw new Error(`Valor pago (R$ ${totalPaid.toFixed(2)}) é menor que o total (R$ ${total.toFixed(2)})`);
      }
      
      const cashPayment = splitPayments.find(p => p.method === "cash");
      if (cashPayment && (!cashPayment.receivedAmount || cashPayment.receivedAmount < cashPayment.amount)) {
        throw new Error("Valor recebido em dinheiro deve ser maior ou igual ao valor pago");
      }

      const paymentMethodString = splitPayments.length === 1 ? splitPayments[0].method : "cash";

      const { data: existingBill } = await supabase
        .from("bills")
        .select("id")
        .eq("table_id", selectedTable.id)
        .in("status", ["pending", "on_the_way"])
        .maybeSingle();

      if (existingBill) {
        const { error: updateBillError } = await supabase
          .from("bills")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_method: paymentMethodString,
            change_amount: getChangeAmount() > 0 ? getChangeAmount() : null,
          })
          .eq("id", existingBill.id);

        if (updateBillError) throw updateBillError;
      } else {
        const { error: billError } = await supabase
          .from("bills")
          .insert({
            table_id: selectedTable.id,
            subtotal: total,
            service_fee: 0,
            total_amount: total,
            payment_method: paymentMethodString,
            status: "paid",
            paid_at: new Date().toISOString(),
            change_amount: getChangeAmount() > 0 ? getChangeAmount() : null,
          });

        if (billError) throw billError;
      }

      for (const order of tableOrders) {
        await supabase.from("orders").update({ status: "delivered" }).eq("id", order.id);
      }

      await supabase
        .from("comandas")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("table_id", selectedTable.id)
        .eq("status", "active");

      await supabase
        .from("tables")
        .update({ is_occupied: false, occupied_at: null, occupied_by: null })
        .eq("id", selectedTable.id);

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-tables"] });
      queryClient.invalidateQueries({ queryKey: ["local-orders"] });
      toast.success("Conta paga! Mesa liberada.");
      setShowPayBillDialog(false);
      setShowTableDetail(false);
      setSelectedTable(null);
      setSplitPayments([]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao pagar conta");
    },
  });

  // Criar comanda manual mutation
  const createComandaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error("Mesa não selecionada");
      if (!newComandaName.trim()) throw new Error("Informe o nome do cliente");
      if (!newComandaCpf.trim()) throw new Error("Informe o CPF do cliente");

      const cleanCpf = newComandaCpf.replace(/\D/g, '');
      if (cleanCpf.length !== 11) throw new Error("CPF inválido");

      const { error: comandaError } = await supabase
        .from("comandas")
        .insert({
          restaurant_id: restaurantId,
          table_id: selectedTable.id,
          customer_name: newComandaName.trim(),
          customer_cpf: cleanCpf,
          status: "active",
        });

      if (comandaError) throw comandaError;

      await supabase
        .from("tables")
        .update({
          is_occupied: true,
          occupied_by: newComandaName.trim(),
          occupied_at: new Date().toISOString(),
        })
        .eq("id", selectedTable.id);

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-tables"] });
      toast.success("Comanda criada! Mesa ocupada.");
      setNewComandaName("");
      setNewComandaCpf("");
      fetchTableDetails(selectedTable!);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar comanda");
    },
  });

  // Adicionar produtos à mesa mutation  
  const addProductsToTableMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error("Mesa não selecionada");
      if (tableCart.length === 0) throw new Error("Carrinho vazio");

      let { data: activeComanda } = await supabase
        .from("comandas")
        .select("id")
        .eq("table_id", selectedTable.id)
        .eq("status", "active")
        .maybeSingle();

      if (!activeComanda) {
        const { data: newComanda, error: comandaError } = await supabase
          .from("comandas")
          .insert({
            restaurant_id: restaurantId,
            table_id: selectedTable.id,
            customer_name: selectedTable.occupied_by || "Cliente PDV",
            customer_cpf: "00000000000",
            status: "active",
          })
          .select()
          .single();

        if (comandaError) throw comandaError;
        activeComanda = newComanda;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          table_id: selectedTable.id,
          comanda_id: activeComanda.id,
          customer_name: selectedTable.occupied_by || "Cliente PDV",
          customer_cpf: "00000000000",
          order_type: "local",
          status: "pending",
          notes: tableOrderNotes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      for (const item of tableCart) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.productId,
            quantity: item.quantity,
            price_at_order: item.price,
            notes: item.notes || null,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        if (item.extras.length > 0) {
          const extrasToInsert = item.extras.map((extra) => ({
            order_item_id: orderItem.id,
            product_extra_id: extra.extraId,
            price_at_order: extra.price,
          }));

          const { error: extrasError } = await supabase
            .from("order_item_extras")
            .insert(extrasToInsert);

          if (extrasError) throw extrasError;
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-tables"] });
      queryClient.invalidateQueries({ queryKey: ["local-orders"] });
      toast.success("Pedido lançado com sucesso!");
      setTableCart([]);
      setTableOrderNotes("");
      setShowAddProductsDialog(false);
      fetchTableDetails(selectedTable!);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao lançar pedido");
    },
  });

  // Table cart functions
  const addToTableCart = (product: any) => {
    setTableCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id && item.extras.length === 0);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && item.extras.length === 0
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, price: product.price, extras: [] }];
    });
    toast.success(`${product.name} adicionado`);
  };

  const updateTableCartQuantity = (index: number, delta: number) => {
    setTableCart((prev) =>
      prev.map((item, i) => i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0)
    );
  };

  const removeFromTableCart = (index: number) => {
    setTableCart((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTableCartSubtotal = () => {
    return tableCart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      return sum + (item.price + extrasTotal) * item.quantity;
    }, 0);
  };

  const occupiedTables = tables?.filter((t) => t.is_occupied).length || 0;
  const availableTables = tables?.filter((t) => !t.is_occupied).length || 0;

  return (
    <div className="h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="balcao" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Balcão
            </TabsTrigger>
            <TabsTrigger value="mesas" className="gap-2">
              <Users className="w-4 h-4" />
              Mesas / Comandas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Aba Balcão - Usa o novo componente BalcaoTab */}
        <TabsContent value="balcao" className="h-[calc(100%-60px)] mt-0">
          <BalcaoTab restaurantId={restaurantId} />
        </TabsContent>

        {/* Aba Mesas */}
        <TabsContent value="mesas" className="mt-0">
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{tables?.length || 0}</p>
                    </div>
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ocupadas</p>
                      <p className="text-2xl font-bold text-destructive">{occupiedTables}</p>
                    </div>
                    <Users className="w-8 h-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Livres</p>
                      <p className="text-2xl font-bold text-green-600">{availableTables}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Grid de Mesas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tables?.map((table) => (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    table.is_occupied
                      ? "border-destructive bg-destructive/10"
                      : "border-green-500 bg-green-500/10"
                  }`}
                  onClick={() => fetchTableDetails(table)}
                >
                  <CardContent className="p-4 text-center">
                    <div
                      className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                        table.is_occupied ? "bg-destructive/20" : "bg-green-500/20"
                      }`}
                    >
                      <Users className={`w-6 h-6 ${table.is_occupied ? "text-destructive" : "text-green-600"}`} />
                    </div>
                    <p className="font-bold">Mesa {table.table_number}</p>
                    <Badge variant={table.is_occupied ? "destructive" : "default"} className="mt-1">
                      {table.is_occupied ? "Ocupada" : "Livre"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Detalhes da Mesa */}
      <Dialog open={showTableDetail} onOpenChange={setShowTableDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Mesa {selectedTable?.table_number}
              <Badge variant={selectedTable?.is_occupied ? "destructive" : "default"}>
                {selectedTable?.is_occupied ? "Ocupada" : "Livre"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedTable?.is_occupied ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Comandas Ativas</h3>
                {tableComandas.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma comanda ativa</p>
                ) : (
                  <div className="space-y-2">
                    {tableComandas.map((comanda) => (
                      <div key={comanda.id} className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">{comanda.customer_name}</p>
                        <p className="text-sm text-muted-foreground">CPF: {comanda.customer_cpf}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Pedidos em Andamento</h3>
                {tableOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum pedido</p>
                ) : (
                  <div className="space-y-2">
                    {tableOrders.map((order) => (
                      <Card key={order.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">#{order.id.slice(0, 8)}</span>
                            <Badge variant="secondary">{order.status}</Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            {order.order_items.map((item: any) => (
                              <p key={item.id}>
                                {item.quantity}x {item.products?.name} - R$ {(item.price_at_order * item.quantity).toFixed(2)}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total da Mesa</span>
                  <span className="text-2xl font-bold text-primary">R$ {calculateTableTotal().toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTableCart([]);
                      setTableOrderNotes("");
                      setShowAddProductsDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Produtos
                  </Button>
                  <Button disabled={tableOrders.length === 0} onClick={openPayBillDialog}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Pagar Conta
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">Mesa disponível</p>
                <p className="text-muted-foreground mb-6">Crie uma comanda para ocupar a mesa</p>
              </div>
              
              <div className="space-y-4 border rounded-lg p-4">
                <h4 className="font-semibold">Criar Comanda</h4>
                <div>
                  <label className="text-sm font-medium">Nome do cliente *</label>
                  <Input
                    value={newComandaName}
                    onChange={(e) => setNewComandaName(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">CPF *</label>
                  <Input
                    value={newComandaCpf}
                    onChange={(e) => setNewComandaCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <Button 
                  className="w-full"
                  onClick={() => createComandaMutation.mutate()}
                  disabled={createComandaMutation.isPending || !newComandaName.trim() || !newComandaCpf.trim()}
                >
                  {createComandaMutation.isPending ? "Criando..." : "Abrir Mesa"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar Produtos à Mesa */}
      <Dialog open={showAddProductsDialog} onOpenChange={setShowAddProductsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Produtos - Mesa {selectedTable?.table_number}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={!selectedCategory ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  Todos
                </Button>
                {categories?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
              
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-2 gap-2">
                  {filteredProducts?.map((product) => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => addToTableCart(product)}
                    >
                      <CardContent className="p-2">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-primary font-bold text-sm">R$ {product.price.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div className="space-y-3 border rounded-lg p-3">
              <h4 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Carrinho
                {tableCart.length > 0 && <Badge variant="secondary">{tableCart.length}</Badge>}
              </h4>
              
              {tableCart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Carrinho vazio</p>
              ) : (
                <div className="space-y-2">
                  {tableCart.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTableCartQuantity(index, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTableCartQuantity(index, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromTableCart(index)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <Textarea
                placeholder="Observações do pedido..."
                value={tableOrderNotes}
                onChange={(e) => setTableOrderNotes(e.target.value)}
                className="h-16 resize-none"
              />
              
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {calculateTableCartSubtotal().toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => addProductsToTableMutation.mutate()}
                  disabled={tableCart.length === 0 || addProductsToTableMutation.isPending}
                >
                  {addProductsToTableMutation.isPending ? "Lançando..." : "Lançar Pedido"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Pagar Conta com Pagamento Dividido */}
      <Dialog open={showPayBillDialog} onOpenChange={setShowPayBillDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Conta - Mesa {selectedTable?.table_number}</DialogTitle>
            <DialogDescription>Total: R$ {calculateTableTotal().toFixed(2)}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Adicionar forma de pagamento:</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="flex-col gap-1 h-16" onClick={() => addSplitPayment("cash")} disabled={getRemainingAmount() <= 0}>
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs">Dinheiro</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-col gap-1 h-16" onClick={() => addSplitPayment("card")} disabled={getRemainingAmount() <= 0}>
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Cartão</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-col gap-1 h-16" onClick={() => addSplitPayment("pix")} disabled={getRemainingAmount() <= 0}>
                  <QrCode className="w-5 h-5" />
                  <span className="text-xs">PIX</span>
                </Button>
              </div>
            </div>

            {splitPayments.length > 0 && (
              <div className="space-y-3 border rounded-lg p-3">
                <p className="text-sm font-medium">Pagamentos:</p>
                {splitPayments.map((payment, index) => (
                  <div key={index} className="space-y-2 p-2 bg-muted rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {payment.method === "cash" && <Banknote className="w-4 h-4" />}
                        {payment.method === "card" && <CreditCard className="w-4 h-4" />}
                        {payment.method === "pix" && <QrCode className="w-4 h-4" />}
                        <span className="font-medium text-sm">
                          {payment.method === "cash" ? "Dinheiro" : payment.method === "card" ? "Cartão" : "PIX"}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSplitPayment(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Valor:</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payment.amount}
                        onChange={(e) => updateSplitPaymentAmount(index, parseFloat(e.target.value) || 0)}
                        className="h-8 w-28"
                      />
                    </div>
                    {payment.method === "cash" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Recebido:</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={payment.receivedAmount || ""}
                            onChange={(e) => updateCashReceivedAmount(index, parseFloat(e.target.value) || 0)}
                            className="h-8 w-28"
                            placeholder="0.00"
                          />
                        </div>
                        {payment.receivedAmount && payment.receivedAmount >= payment.amount && (
                          <p className="text-sm text-green-600 font-medium">Troco: R$ {(payment.receivedAmount - payment.amount).toFixed(2)}</p>
                        )}
                        {payment.receivedAmount && payment.receivedAmount < payment.amount && (
                          <p className="text-sm text-destructive">Valor recebido insuficiente</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total da conta:</span>
                <span className="font-medium">R$ {calculateTableTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total pago:</span>
                <span className="font-medium">R$ {getTotalSplitPayments().toFixed(2)}</span>
              </div>
              {getRemainingAmount() > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Falta pagar:</span>
                  <span className="font-medium">R$ {getRemainingAmount().toFixed(2)}</span>
                </div>
              )}
              {getChangeAmount() > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Troco total:</span>
                  <span className="font-medium">R$ {getChangeAmount().toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 p-3 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Ao confirmar:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                <li>Pedidos marcados como entregues</li>
                <li>Comandas fechadas</li>
                <li>Mesa liberada</li>
              </ul>
            </div>

            <Button
              className="w-full"
              disabled={payBillMutation.isPending || splitPayments.length === 0 || getRemainingAmount() > 0}
              onClick={() => payBillMutation.mutate()}
            >
              {payBillMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDVTab;
