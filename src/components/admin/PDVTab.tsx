import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Search, Users, ShoppingCart, UserPlus, X, Loader2, Settings,
  MoreVertical, QrCode, Link2, Eraser, CheckCircle, Package
} from "lucide-react";
import { toast } from "sonner";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { CustomerSelectDialog } from "./CustomerSelectDialog";
import { TableDetailDialog } from "./TableDetailDialog";
import { ManageTablesDrawer } from "./ManageTablesDrawer";

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: { extraId: string; name: string; price: number; is_complement?: boolean }[];
}

interface TableData {
  id: string;
  table_number: number;
  table_name: string | null;
  is_occupied: boolean;
  occupied_by: string | null;
  occupied_at: string | null;
  min_capacity: number;
  max_capacity: number;
  comandas?: { id: string; customer_name: string; customer_cpf: string }[];
}

interface PDVTabProps {
  restaurantId: string;
  pendingTableToOpen?: string | null;
  onTableOpened?: () => void;
}

const PDVTab = ({ restaurantId, pendingTableToOpen, onTableOpened }: PDVTabProps) => {
  const queryClient = useQueryClient();

  // Order creation state
  const [orderType, setOrderType] = useState<"mesa" | "delivery" | "retirada" | "viagem">("mesa");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Customer fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCep, setDeliveryCep] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");

  // Table management state
  const [selectedTableForDrawer, setSelectedTableForDrawer] = useState<TableData | null>(null);
  const [isManageTablesOpen, setIsManageTablesOpen] = useState(false);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);

  // Fetch restaurant slug
  useEffect(() => {
    supabase.from("restaurants").select("slug").eq("id", restaurantId).single()
      .then(({ data }) => { if (data) setRestaurantSlug(data.slug); });
  }, [restaurantId]);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["pdv-products-create", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!inner(id, name, restaurant_id), product_extras(*)")
        .eq("categories.restaurant_id", restaurantId)
        .eq("available", true)
        .order("name");
      return data || [];
    },
  });

  // Fetch tables
  const { data: tables, refetch: refetchTables } = useQuery({
    queryKey: ["pdv-tables", restaurantId],
    queryFn: async () => {
      const { data: tablesData } = await supabase
        .from("tables").select("*").eq("restaurant_id", restaurantId)
        .neq("table_number", 9999).order("display_order").order("table_number");

      const tableIds = (tablesData || []).map(t => t.id);
      let comandasData: any[] = [];
      if (tableIds.length > 0) {
        const { data } = await supabase.from("comandas")
          .select("id, table_id, customer_name, customer_cpf")
          .in("table_id", tableIds).eq("status", "active");
        comandasData = data || [];
      }

      return (tablesData || []).map(t => ({
        ...t,
        comandas: comandasData.filter(c => c.table_id === t.id),
      })) as TableData[];
    },
  });

  // Realtime for tables
  useEffect(() => {
    const ch = supabase.channel("pdv-tables-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => refetchTables())
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, () => refetchTables())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetchTables]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products;
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      return sum + (item.price + extrasTotal) * item.quantity;
    }, 0);
  }, [cart]);

  const handleAddToCart = (item: CartItem) => {
    setCart(prev => [...prev, item]);
    toast.success(`${item.productName} adicionado!`);
  };

  const handleCustomerSelect = (customer: { id: string; cpf: string; name: string; phone: string | null; defaultAddress?: any }) => {
    setCustomerName(customer.name);
    setCustomerCpf(customer.cpf);
    setCustomerPhone(customer.phone || "");
    // Auto-fill address if delivery and address available
    if (customer.defaultAddress && orderType === "delivery") {
      setDeliveryAddress(customer.defaultAddress.street + (customer.defaultAddress.number ? `, ${customer.defaultAddress.number}` : ""));
      setDeliveryCep(customer.defaultAddress.zip_code || "");
      setDeliveryNeighborhood(customer.defaultAddress.neighborhood || "");
      setDeliveryCity(`${customer.defaultAddress.city} - ${customer.defaultAddress.state}`);
    }
  };

  const handleCepLookup = async (cep: string) => {
    setDeliveryCep(cep);
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setDeliveryAddress(data.logradouro || "");
        setDeliveryNeighborhood(data.bairro || "");
        setDeliveryCity(`${data.localidade} - ${data.uf}`);
      }
    } catch { /* ignore */ }
  };

  const clearForm = () => {
    setCart([]);
    setCustomerName(""); setCustomerPhone(""); setCustomerCpf("");
    setDeliveryAddress(""); setDeliveryCep(""); setDeliveryNeighborhood(""); setDeliveryCity("");
    setNotes(""); setPaymentType(""); setSelectedTableId("");
  };

  const insertOrderItems = async (orderId: string) => {
    for (const item of cart) {
      const { data: oi, error } = await supabase.from("order_items").insert({
        order_id: orderId, product_id: item.productId,
        quantity: item.quantity, price_at_order: item.price, notes: item.notes || null,
      }).select().single();
      if (error) throw error;
      if (item.extras.length > 0) {
        await supabase.from("order_item_extras").insert(
          item.extras.map(e => ({
            order_item_id: oi.id,
            product_extra_id: e.is_complement ? null : e.extraId,
            price_at_order: e.price,
          }))
        );
      }
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error("Adicione produtos ao carrinho"); return; }
    if (!customerName && orderType !== "mesa" && orderType !== "viagem") { toast.error("Nome do cliente é obrigatório"); return; }

    setSubmitting(true);
    try {
      if (orderType === "delivery") {
        if (!customerPhone) throw new Error("Telefone é obrigatório para delivery");
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "delivery",
          status: "pending", customer_name: customerName,
          customer_cpf: customerCpf || "000.000.000-00",
          delivery_phone: customerPhone,
          delivery_address: deliveryAddress ? `${deliveryAddress}, ${deliveryNeighborhood}, ${deliveryCity}` : null,
          notes: notes || null, payment_type: paymentType || null,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else if (orderType === "retirada") {
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "pickup",
          status: "pending", customer_name: customerName || "Cliente",
          customer_cpf: customerCpf || "000.000.000-00",
          notes: notes || null, payment_type: paymentType || null,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else if (orderType === "viagem") {
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "takeaway",
          status: "pending", customer_name: customerName || "Cliente Viagem",
          customer_cpf: customerCpf || "000.000.000-00",
          notes: notes || null, payment_type: paymentType || null,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else {
        // Mesa
        const tableId = selectedTableId;
        if (!tableId) throw new Error("Selecione uma mesa");
        const table = tables?.find(t => t.id === tableId);
        if (!table) throw new Error("Mesa não encontrada");

        let comandaId: string | null = null;
        if (table.is_occupied) {
          const { data: existingComanda } = await supabase.from("comandas")
            .select("*").eq("table_id", tableId).eq("status", "active")
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (existingComanda) {
            comandaId = existingComanda.id;
          } else {
            const { data: nc } = await supabase.from("comandas").insert({
              restaurant_id: restaurantId, table_id: tableId,
              customer_name: customerName || "Cliente PDV",
              customer_cpf: customerCpf || "000.000.000-00", status: "active",
            }).select().single();
            comandaId = nc?.id || null;
          }
        } else {
          await supabase.from("tables").update({
            is_occupied: true, occupied_at: new Date().toISOString(),
            occupied_by: customerName || "PDV",
          }).eq("id", tableId);
          const { data: nc } = await supabase.from("comandas").insert({
            restaurant_id: restaurantId, table_id: tableId,
            customer_name: customerName || "Cliente PDV",
            customer_cpf: customerCpf || "000.000.000-00", status: "active",
          }).select().single();
          comandaId = nc?.id || null;
        }

        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "local", table_id: tableId,
          comanda_id: comandaId, status: "pending",
          customer_name: customerName || "Cliente PDV",
          customer_cpf: customerCpf || "000.000.000-00",
          notes: notes || null, payment_type: paymentType || null,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);
      }

      toast.success("Pedido criado com sucesso!");
      clearForm();
      refetchTables();
      queryClient.invalidateQueries({ queryKey: ["unified-orders"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  // Table actions
  const getTableMenuUrl = (tableNumber: number) => {
    const base = window.location.origin;
    return restaurantSlug ? `${base}/${restaurantSlug}/mesa/${tableNumber}` : null;
  };

  const handleCopyLink = (table: TableData) => {
    const url = getTableMenuUrl(table.table_number);
    if (!url) { toast.error("Slug do restaurante não encontrado"); return; }
    navigator.clipboard.writeText(url);
    toast.success(`Link da Mesa ${table.table_number} copiado!`);
  };

  const handleShowQR = (table: TableData) => {
    const url = getTableMenuUrl(table.table_number);
    if (!url) { toast.error("Slug do restaurante não encontrado"); return; }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
    window.open(qrUrl, "_blank");
  };

  const handleClearTable = async (table: TableData) => {
    if (!confirm(`Limpar Mesa ${table.table_number}? Isso irá cancelar pedidos ativos, fechar comandas e liberar a mesa.`)) return;
    await supabase.from("orders").update({ status: "cancelled" })
      .eq("table_id", table.id).in("status", ["pending", "accepted", "preparing", "ready"]);
    await supabase.from("bills").update({ status: "cancelled" })
      .eq("table_id", table.id).neq("status", "paid");
    await supabase.from("comandas").update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("table_id", table.id).eq("status", "active");
    await supabase.from("tables").update({ is_occupied: false, occupied_by: null, occupied_at: null }).eq("id", table.id);
    toast.success(`Mesa ${table.table_number} liberada`);
    refetchTables();
  };

  const handleTableClick = (table: TableData) => {
    setSelectedTableForDrawer(table);
  };

  const handleTableSelect = (table: TableData) => {
    setOrderType("mesa");
    setSelectedTableId(table.id);
  };

  const occupiedTables = tables?.filter(t => t.is_occupied).length || 0;
  const availableTables = tables?.filter(t => !t.is_occupied).length || 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">PDV</h2>
          <p className="text-sm text-muted-foreground">
            {tables?.length || 0} mesas • {occupiedTables} ocupadas • {availableTables} livres
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsManageTablesOpen(true)}>
          <Settings className="w-4 h-4 mr-1.5" />
          Gerenciar Mesas
        </Button>
      </div>

      {/* Main content: tables grid + order panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Tables Grid */}
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables?.map(table => {
              const isOccupied = table.is_occupied;
              const comandaCount = table.comandas?.length || 0;
              const isSelected = selectedTableId === table.id;
              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:shadow-md relative ${
                    isSelected ? "ring-2 ring-primary border-primary" :
                    isOccupied ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border"
                  }`}
                  onClick={() => handleTableClick(table)}
                  onDoubleClick={() => handleTableSelect(table)}
                >
                  {/* Three-dot menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 z-10"
                        onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleShowQR(table)}>
                        <QrCode className="w-4 h-4 mr-2" /> QR Code
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyLink(table)}>
                        <Link2 className="w-4 h-4 mr-2" /> Copiar Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTableSelect(table)}>
                        <ShoppingCart className="w-4 h-4 mr-2" /> Criar Pedido
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleClearTable(table)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Eraser className="w-4 h-4 mr-2" /> Limpar Mesa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <CardContent className="p-4 text-center space-y-1">
                    <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white text-sm font-bold ${
                      isOccupied ? "bg-green-500" : "bg-muted-foreground/40"
                    }`}>
                      {table.table_number}
                    </div>
                    <p className="text-xs font-medium">{table.table_name || `Mesa ${table.table_number}`}</p>
                    <Badge variant={isOccupied ? "default" : "secondary"} className="text-[10px]">
                      {isOccupied ? `${comandaCount} comanda${comandaCount !== 1 ? "s" : ""}` : "Livre"}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right: Order Creation Panel (always visible) */}
        <div className="w-[420px] flex-shrink-0 border-l pl-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">Novo Pedido</h3>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearForm} className="text-xs text-muted-foreground">
                Limpar
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-2">
              {/* Order type tabs */}
              <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="mesa" className="text-xs">Mesa</TabsTrigger>
                  <TabsTrigger value="delivery" className="text-xs">Delivery</TabsTrigger>
                  <TabsTrigger value="retirada" className="text-xs">Retirada</TabsTrigger>
                  <TabsTrigger value="viagem" className="text-xs">Viagem</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Customer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Cliente</Label>
                  <Button variant="ghost" size="sm" onClick={() => setIsCustomerSelectOpen(true)} className="h-6 text-xs">
                    <UserPlus className="w-3 h-3 mr-1" /> Buscar
                  </Button>
                </div>
                <Input placeholder="Nome" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-8 text-sm" />
                {orderType === "delivery" && (
                  <Input placeholder="Telefone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-8 text-sm" />
                )}
                <Input placeholder="CPF (opcional)" value={customerCpf} onChange={e => setCustomerCpf(e.target.value)} className="h-8 text-sm" />
              </div>

              {/* Type-specific fields */}
              {orderType === "delivery" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Endereço</Label>
                  <Input placeholder="CEP" value={deliveryCep} onChange={e => handleCepLookup(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Rua" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Bairro" value={deliveryNeighborhood} onChange={e => setDeliveryNeighborhood(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Cidade" value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} className="h-8 text-sm" />
                </div>
              )}

              {orderType === "mesa" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Mesa</Label>
                  <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione uma mesa" /></SelectTrigger>
                    <SelectContent>
                      {tables?.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          Mesa {t.table_number} {t.is_occupied ? "(Ocupada)" : "(Livre)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Observações</Label>
                <Textarea placeholder="Observações..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[50px] text-sm" />
              </div>

              {/* Payment */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Pagamento</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Método de pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="meal_voucher">Vale Refeição</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products search + grid */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto">
                  {filteredProducts.map(product => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedProduct(product); setIsProductDrawerOpen(true); }}
                    >
                      <CardContent className="p-1.5 space-y-0.5">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-12 object-cover rounded" />
                        ) : (
                          <div className="w-full h-12 bg-muted rounded flex items-center justify-center text-sm font-bold text-muted-foreground">
                            {product.name.charAt(0)}
                          </div>
                        )}
                        <p className="text-[11px] font-medium truncate">{product.name}</p>
                        <p className="text-[11px] font-bold text-primary">R$ {product.price.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Cart Summary */}
              {cart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" /> Carrinho ({cart.length})
                  </h4>
                  {cart.map((item, i) => {
                    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
                    const itemTotal = (item.price + extrasTotal) * item.quantity;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.quantity}x</span> {item.productName}
                          {item.extras.length > 0 && (
                            <span className="text-muted-foreground ml-1">(+{item.extras.length})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">R$ {itemTotal.toFixed(2)}</span>
                          <Button variant="ghost" size="sm" onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="h-5 w-5 p-0">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between font-bold text-sm pt-2 border-t">
                    <span>Total</span>
                    <span>R$ {cartSubtotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t pt-3 mt-2 flex items-center justify-between">
            <div className="text-xs">
              <ShoppingCart className="w-3.5 h-3.5 inline mr-1" />
              {cart.length} ite{cart.length !== 1 ? "ns" : "m"} • <span className="font-bold">R$ {cartSubtotal.toFixed(2)}</span>
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || cart.length === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Criar Pedido
            </Button>
          </div>
        </div>
      </div>

      {/* Product Drawer */}
      <PDVProductDrawer
        product={selectedProduct}
        open={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        onAddToCart={handleAddToCart}
      />

      {/* Customer Select */}
      <CustomerSelectDialog
        restaurantId={restaurantId}
        open={isCustomerSelectOpen}
        onOpenChange={setIsCustomerSelectOpen}
        onSelect={handleCustomerSelect}
      />

      {/* Table Detail Dialog */}
      <TableDetailDialog
        restaurantId={restaurantId}
        table={selectedTableForDrawer}
        open={!!selectedTableForDrawer}
        onOpenChange={(open) => { if (!open) setSelectedTableForDrawer(null); }}
        onAddOrder={(tableId) => {
          setSelectedTableForDrawer(null);
          setOrderType("mesa");
          setSelectedTableId(tableId);
        }}
        onTableCleared={() => refetchTables()}
      />

      {/* Manage Tables Drawer */}
      <ManageTablesDrawer
        restaurantId={restaurantId}
        open={isManageTablesOpen}
        onOpenChange={setIsManageTablesOpen}
        onTablesChanged={() => refetchTables()}
      />
    </div>
  );
};

export default PDVTab;
