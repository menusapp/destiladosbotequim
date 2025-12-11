import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Trash2, ShoppingCart, Package, MapPin, Users, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { CustomerSelectDialog } from "./CustomerSelectDialog";

interface BalcaoTabProps {
  restaurantId: string;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: {
    extraId: string;
    name: string;
    price: number;
  }[];
}

const BalcaoTab = ({ restaurantId }: BalcaoTabProps) => {
  const queryClient = useQueryClient();
  
  // Product selection
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Order type
  const [orderType, setOrderType] = useState<"online" | "local">("local");
  
  // Online order fields
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("pickup");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [isAutoFillingCpf, setIsAutoFillingCpf] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [paymentType, setPaymentType] = useState("");
  
  // Local order fields
  const [selectedTableId, setSelectedTableId] = useState("");
  
  // Customer selection
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products with extras
  const { data: products } = useQuery({
    queryKey: ["products-with-extras", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories!inner(id, name, restaurant_id),
          product_extras(*)
        `)
        .eq("categories.restaurant_id", restaurantId)
        .eq("available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch tables
  const { data: tables } = useQuery({
    queryKey: ["tables", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });

  // Fetch delivery config
  const { data: deliveryConfig } = useQuery({
    queryKey: ["delivery-config", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Cart calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((eSum, e) => eSum + e.price, 0);
      return sum + (item.price + extrasTotal) * item.quantity;
    }, 0);
  }, [cart]);

  const deliveryFee = orderType === "online" && deliveryType === "delivery" 
    ? (deliveryConfig?.delivery_fee || 0) 
    : 0;

  const cartTotal = cartSubtotal + deliveryFee;

  // Add item to cart from drawer
  const handleAddToCart = (item: CartItem) => {
    setCart(prev => [...prev, item]);
    toast.success(`${item.productName} adicionado!`);
  };

  // Remove item from cart
  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCpf("");
    setDeliveryAddress("");
    setDeliveryNeighborhood("");
    setDeliveryCity("");
    setPaymentType("");
    setSelectedTableId("");
    setSelectedCustomerId(null);
  };

  // Handle customer selection from dialog
  const handleCustomerSelect = (customer: { id: string; cpf: string; name: string; phone: string | null }) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerCpf(customer.cpf);
    setCustomerPhone(customer.phone || "");
    toast.success(`Cliente ${customer.name} selecionado`);
  };

  // Clear selected customer
  const clearSelectedCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerName("");
    setCustomerCpf("");
    setCustomerPhone("");
  };

  // Auto-fill customer when CPF is typed manually
  const handleCpfChange = async (value: string) => {
    setCustomerCpf(value);
    
    // Only check if CPF is complete (11 digits)
    const cleanCpf = value.replace(/\D/g, "");
    if (cleanCpf.length !== 11 || selectedCustomerId) return;
    
    setIsAutoFillingCpf(true);
    try {
      const { data: existing } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("restaurant_id", restaurantId)
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (existing) {
        setSelectedCustomerId(existing.id);
        setCustomerName(existing.name);
        setCustomerPhone(existing.phone || "");
        toast.success(`Cliente ${existing.name} encontrado!`);
      }
    } catch (error) {
      console.error("Error checking customer:", error);
    } finally {
      setIsAutoFillingCpf(false);
    }
  };

  // Auto-create/update customer on order creation
  const upsertCustomer = async (cpf: string, name: string, phone: string | null) => {
    if (!cpf || cpf === "000.000.000-00") return;
    
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return;

    try {
      // Check if customer exists
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (existing) {
        // Update existing customer
        await supabase
          .from("customers")
          .update({ name, phone: phone || null })
          .eq("id", existing.id);
      } else {
        // Create new customer
        await supabase
          .from("customers")
          .insert({
            restaurant_id: restaurantId,
            cpf: cleanCpf,
            name,
            phone: phone || null,
          });
      }
    } catch (error) {
      console.error("Error upserting customer:", error);
    }
  };

  // Open product drawer
  const openProductDrawer = (product: any) => {
    setSelectedProduct(product);
    setIsProductDrawerOpen(true);
  };

  // Create online order mutation
  const createOnlineOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Carrinho vazio");
      if (!customerName) throw new Error("Nome do cliente é obrigatório");
      if (!customerPhone) throw new Error("Telefone é obrigatório");
      if (deliveryType === "delivery" && !deliveryAddress) throw new Error("Endereço é obrigatório");

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          order_type: "delivery",
          delivery_type: deliveryType,
          status: "pending",
          customer_name: customerName,
          customer_cpf: customerCpf || "000.000.000-00",
          delivery_phone: customerPhone,
          delivery_address: deliveryType === "delivery" ? deliveryAddress : null,
          delivery_neighborhood: deliveryType === "delivery" ? deliveryNeighborhood : null,
          delivery_city: deliveryType === "delivery" ? deliveryCity : null,
          delivery_fee: deliveryFee,
          payment_type: paymentType || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert items
      for (const item of cart) {
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

        // Insert extras
        if (item.extras.length > 0) {
          const { error: extrasError } = await supabase
            .from("order_item_extras")
            .insert(
              item.extras.map((e) => ({
                order_item_id: orderItem.id,
                product_extra_id: e.extraId,
                price_at_order: e.price,
              }))
            );
          if (extrasError) throw extrasError;
        }
      }

      // Auto-create customer if CPF provided
      await upsertCustomer(customerCpf, customerName, customerPhone);

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Pedido online enviado para 'Aguardando Confirmação'!");
      clearCart();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar pedido");
    },
  });

  // Create local order mutation
  const createLocalOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Carrinho vazio");
      if (!selectedTableId) throw new Error("Selecione uma mesa");

      const table = tables?.find((t) => t.id === selectedTableId);
      if (!table) throw new Error("Mesa não encontrada");

      let comandaId: string | null = null;

      // Check if table is occupied
      if (table.is_occupied) {
        // Find active comanda for this table
        const { data: existingComanda, error: comandaError } = await supabase
          .from("comandas")
          .select("*")
          .eq("table_id", selectedTableId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (comandaError && comandaError.code !== "PGRST116") throw comandaError;

        if (existingComanda) {
          comandaId = existingComanda.id;
        } else {
          // Create new comanda if table is occupied but no active comanda
          const { data: newComanda, error: newComandaError } = await supabase
            .from("comandas")
            .insert({
              restaurant_id: restaurantId,
              table_id: selectedTableId,
              customer_name: customerName || "Cliente PDV",
              customer_cpf: customerCpf || "000.000.000-00",
              status: "active",
            })
            .select()
            .single();

          if (newComandaError) throw newComandaError;
          comandaId = newComanda.id;
        }
      } else {
        // Table is free - mark as occupied and create comanda
        const { error: updateTableError } = await supabase
          .from("tables")
          .update({
            is_occupied: true,
            occupied_at: new Date().toISOString(),
            occupied_by: customerName ? `${customerName}${customerCpf ? ` - ${customerCpf}` : ""}` : "PDV",
          })
          .eq("id", selectedTableId);

        if (updateTableError) throw updateTableError;

        // Create new comanda
        const { data: newComanda, error: newComandaError } = await supabase
          .from("comandas")
          .insert({
            restaurant_id: restaurantId,
            table_id: selectedTableId,
            customer_name: customerName || "Cliente PDV",
            customer_cpf: customerCpf || "000.000.000-00",
            status: "active",
          })
          .select()
          .single();

        if (newComandaError) throw newComandaError;
        comandaId = newComanda.id;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          order_type: "local",
          table_id: selectedTableId,
          comanda_id: comandaId,
          status: "pending",
          customer_name: customerName || "Cliente PDV",
          customer_cpf: customerCpf || "000.000.000-00",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert items
      for (const item of cart) {
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

        // Insert extras
        if (item.extras.length > 0) {
          const { error: extrasError } = await supabase
            .from("order_item_extras")
            .insert(
              item.extras.map((e) => ({
                order_item_id: orderItem.id,
                product_extra_id: e.extraId,
                price_at_order: e.price,
              }))
            );
          if (extrasError) throw extrasError;
        }
      }

      // Auto-create customer if CPF provided
      await upsertCustomer(customerCpf, customerName || "Cliente PDV", null);

      return { order, tableNumber: table.table_number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(`Pedido lançado para Mesa ${data.tableNumber}!`);
      clearCart();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar pedido");
    },
  });

  const handleLaunchOrder = () => {
    if (orderType === "online") {
      createOnlineOrderMutation.mutate();
    } else {
      createLocalOrderMutation.mutate();
    }
  };

  const isLoading = createOnlineOrderMutation.isPending || createLocalOrderMutation.isPending;

  return (
    <div className="h-[calc(100vh-200px)] flex gap-4">
      {/* Left side - Product grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search and filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            Todos
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="whitespace-nowrap"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Products grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => openProductDrawer(product)}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-muted flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {product.promotional_price ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through">
                          R$ {product.price.toFixed(2)}
                        </span>
                        <span className="text-sm font-bold text-primary">
                          R$ {product.promotional_price.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        R$ {product.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right side - Cart and order config */}
      <Card className="w-[380px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5" />
            Carrinho
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {cart.length} {cart.length === 1 ? "item" : "itens"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
          {/* Order type selection */}
          <div className="mb-4">
            <Label className="text-sm font-medium mb-2 block">Tipo de Pedido</Label>
            <RadioGroup
              value={orderType}
              onValueChange={(v) => setOrderType(v as "online" | "local")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="local" />
                <span className="text-sm">Pedido Local</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="online" />
                <span className="text-sm">Pedido Online</span>
              </label>
            </RadioGroup>
          </div>

          {/* Dynamic fields based on order type */}
          <div className="space-y-3 mb-4">
            {orderType === "online" ? (
              <>
                {/* Delivery type */}
                <div>
                  <Label className="text-sm mb-1 block">Tipo</Label>
                  <RadioGroup
                    value={deliveryType}
                    onValueChange={(v) => setDeliveryType(v as "delivery" | "pickup")}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="pickup" />
                      <span className="text-sm">Retirada</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="delivery" />
                      <span className="text-sm">Entrega</span>
                    </label>
                  </RadioGroup>
                </div>

                {/* Customer select button */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCustomerSelectOpen(true)}
                    className="flex-1"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {selectedCustomerId ? "Trocar Cliente" : "Selecionar Cliente"}
                  </Button>
                  {selectedCustomerId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelectedCustomer}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome *</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nome do cliente"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Telefone *</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="h-9"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">CPF (opcional)</Label>
                  <Input
                    value={customerCpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    className="h-9"
                    disabled={isAutoFillingCpf}
                  />
                </div>

                {deliveryType === "delivery" && (
                  <>
                    <div>
                      <Label className="text-xs">Endereço *</Label>
                      <Input
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Rua, número"
                        className="h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Bairro</Label>
                        <Input
                          value={deliveryNeighborhood}
                          onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                          placeholder="Bairro"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cidade</Label>
                        <Input
                          value={deliveryCity}
                          onChange={(e) => setDeliveryCity(e.target.value)}
                          placeholder="Cidade"
                          className="h-9"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <Label className="text-xs">Pagamento</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {/* Table selection */}
                <div>
                  <Label className="text-xs">Mesa *</Label>
                  <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables?.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          <div className="flex items-center gap-2">
                            <span>Mesa {table.table_number}</span>
                            {table.is_occupied ? (
                              <Badge variant="secondary" className="text-xs">Ocupada</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-green-600">Livre</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer select button for local orders */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCustomerSelectOpen(true)}
                    className="flex-1"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {selectedCustomerId ? "Trocar Cliente" : "Selecionar Cliente"}
                  </Button>
                  {selectedCustomerId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelectedCustomer}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome (opcional)</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nome do cliente"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CPF (opcional)</Label>
                    <Input
                      value={customerCpf}
                      onChange={(e) => handleCpfChange(e.target.value)}
                      placeholder="000.000.000-00"
                      className="h-9"
                      disabled={isAutoFillingCpf}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto border-t border-b py-3 mb-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Carrinho vazio</p>
                <p className="text-xs">Clique nos produtos para adicionar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => {
                  const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
                  const itemTotal = (item.price + extrasTotal) * item.quantity;
                  return (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium">
                            {item.quantity}x {item.productName}
                          </span>
                          <button
                            onClick={() => removeFromCart(index)}
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {item.extras.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            + {item.extras.map((e) => e.name).join(", ")}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">
                        R$ {itemTotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {cartSubtotal.toFixed(2)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span>R$ {deliveryFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex-1"
            >
              Limpar
            </Button>
            <Button
              onClick={handleLaunchOrder}
              disabled={cart.length === 0 || isLoading}
              className="flex-1"
            >
              {isLoading ? "Enviando..." : "Lançar Pedido"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Product drawer */}
      <PDVProductDrawer
        product={selectedProduct}
        open={isProductDrawerOpen}
        onClose={() => {
          setIsProductDrawerOpen(false);
          setSelectedProduct(null);
        }}
        onAddToCart={handleAddToCart}
      />

      {/* Customer select dialog */}
      <CustomerSelectDialog
        restaurantId={restaurantId}
        open={isCustomerSelectOpen}
        onOpenChange={setIsCustomerSelectOpen}
        onSelect={handleCustomerSelect}
      />
    </div>
  );
};

export default BalcaoTab;
