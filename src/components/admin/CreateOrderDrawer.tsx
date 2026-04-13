import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShoppingCart, UserPlus, X, Loader2, Percent, DollarSign, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { CustomerSelectDialog } from "./CustomerSelectDialog";

const CARD_BRANDS_PDV = [
  { code: "visa", name: "Visa" },
  { code: "mastercard", name: "Mastercard" },
  { code: "elo", name: "Elo" },
  { code: "amex", name: "Amex" },
  { code: "hipercard", name: "Hipercard" },
  { code: "diners", name: "Diners" },
];

const VOUCHER_BRANDS_PDV = [
  { code: "alelo", name: "Alelo" },
  { code: "sodexo", name: "Sodexo" },
  { code: "ticket", name: "Ticket" },
  { code: "vr", name: "VR" },
  { code: "pluxee", name: "Pluxee" },
];

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: { extraId: string; name: string; price: number }[];
}

interface CreateOrderDrawerProps {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: () => void;
}

export const CreateOrderDrawer = ({ restaurantId, open, onOpenChange, onOrderCreated }: CreateOrderDrawerProps) => {
  const queryClient = useQueryClient();
  const [orderType, setOrderType] = useState<"delivery" | "mesa" | "retirada">("delivery");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCep, setDeliveryCep] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentBrand, setPaymentBrand] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryFeeAuto, setDeliveryFeeAuto] = useState<number | null>(null);

  // Employee credit states
  const [employeeCreditName, setEmployeeCreditName] = useState("");
  const [employeeCreditNotes, setEmployeeCreditNotes] = useState("");

  // Fetch delivery config for auto fee calculation
  const { data: deliveryConfig } = useQuery({
    queryKey: ["delivery-config-pdv", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  const { data: deliveryZones } = useQuery({
    queryKey: ["delivery-zones-pdv", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);
      return data || [];
    },
    enabled: open,
  });

  // Auto-calculate delivery fee based on neighborhood
  useEffect(() => {
    if (orderType !== "delivery" || !deliveryNeighborhood) {
      setDeliveryFeeAuto(null);
      return;
    }
    const normalizedNeighborhood = deliveryNeighborhood.toLowerCase().trim();
    const matchingZone = deliveryZones?.find(zone =>
      zone.neighborhoods?.some((n: string) => n.toLowerCase().trim() === normalizedNeighborhood)
    );
    if (matchingZone) {
      setDeliveryFeeAuto(matchingZone.delivery_fee || 0);
      setDeliveryFee((matchingZone.delivery_fee || 0).toFixed(2));
    } else if (deliveryConfig?.delivery_fee) {
      setDeliveryFeeAuto(deliveryConfig.delivery_fee);
      setDeliveryFee(deliveryConfig.delivery_fee.toFixed(2));
    } else {
      setDeliveryFeeAuto(null);
    }
  }, [deliveryNeighborhood, deliveryZones, deliveryConfig, orderType]);



  const { data: products } = useQuery({
    queryKey: ["products-create-order", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!inner(id, name, restaurant_id), product_extras(*, extra_categories(name))")
        .eq("categories.restaurant_id", restaurantId)
        .eq("available", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: tables } = useQuery({
    queryKey: ["tables-create-order", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tables").select("*").eq("restaurant_id", restaurantId)
        .neq("table_number", 9999).order("table_number");
      return data || [];
    },
    enabled: open,
  });

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

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) return 0;
    if (discountType === "percentage") return Math.min(cartSubtotal * (val / 100), cartSubtotal);
    return Math.min(val, cartSubtotal);
  }, [discountValue, discountType, cartSubtotal]);

  const resolvedDeliveryFeeVal = orderType === "delivery" ? (parseFloat(deliveryFee) || 0) : 0;
  const cartTotal = cartSubtotal - discountAmount + resolvedDeliveryFeeVal;

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
    setNotes(""); setPaymentMethod(""); setPaymentBrand(""); setSelectedTableId("");
    setDiscountType("percentage"); setDiscountValue("");
    setDeliveryFee(""); setDeliveryFeeAuto(null);
    setEmployeeCreditName(""); setEmployeeCreditNotes("");
  };

  // CRM: Save/update customer data before creating orders
  const upsertCustomerCRM = async () => {
    const cpf = customerCpf?.replace(/\D/g, "");
    if (!cpf || cpf.length < 11) return;
    const name = customerName || "Cliente";
    const phone = customerPhone || null;

    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("cpf", customerCpf)
      .maybeSingle();

    if (existing) {
      await supabase.from("customers").update({ name, phone }).eq("id", existing.id);
    } else {
      await supabase.from("customers").insert({
        restaurant_id: restaurantId, cpf: customerCpf, name, phone,
      });
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error("Adicione produtos ao carrinho"); return; }

    // Validate delivery address for delivery orders
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("Informe o endereço de entrega");
      return;
    }

    // Resolve payment type
    let resolvedPaymentType: string | null = null;
    let resolvedPaymentBrand: string | null = null;

    if (paymentMethod === "credit" || paymentMethod === "debit") {
      const methodLabel = paymentMethod === "credit" ? "Crédito" : "Débito";
      if (paymentBrand) {
        const brandName = CARD_BRANDS_PDV.find(b => b.code === paymentBrand)?.name || paymentBrand;
        resolvedPaymentType = `${methodLabel} - ${brandName}`;
        resolvedPaymentBrand = paymentBrand;
      } else {
        resolvedPaymentType = methodLabel;
      }
    } else if (paymentMethod === "meal_voucher") {
      if (paymentBrand) {
        const brandName = VOUCHER_BRANDS_PDV.find(b => b.code === paymentBrand)?.name || paymentBrand;
        resolvedPaymentType = `Vale - ${brandName}`;
        resolvedPaymentBrand = paymentBrand;
      } else {
        resolvedPaymentType = "Vale Refeição";
      }
    } else if (paymentMethod === "cash") {
      resolvedPaymentType = "Dinheiro";
    } else if (paymentMethod === "pix") {
      resolvedPaymentType = "PIX";
    } else if (paymentMethod === "employee_credit") {
      resolvedPaymentType = "Crédito Funcionário";
    } else if (paymentMethod) {
      resolvedPaymentType = paymentMethod;
    }

    setSubmitting(true);
    try {
      // Save customer to CRM
      await upsertCustomerCRM();

      // Save delivery address to CRM if applicable
      if (orderType === "delivery" && customerCpf && deliveryAddress) {
        try {
          const cleanCpf = customerCpf.replace(/\D/g, "");
          const { data: existing } = await supabase
            .from("customer_addresses")
            .select("id")
            .eq("customer_cpf", cleanCpf)
            .eq("street", deliveryAddress);
          if (!existing || existing.length === 0) {
            let city = deliveryCity || "";
            let state = "SP";
            if (deliveryCity?.includes(" - ")) {
              const parts = deliveryCity.split(" - ");
              city = parts[0].trim();
              state = parts[1]?.trim() || "SP";
            }
            await supabase.from("customer_addresses").insert({
              customer_cpf: cleanCpf,
              customer_name: customerName || "Cliente PDV",
              customer_phone: customerPhone || "0",
              street: deliveryAddress,
              number: "S/N",
              neighborhood: deliveryNeighborhood || "",
              city,
              state,
              zip_code: deliveryCep || "00000-000",
              is_default: false,
            });
          }
        } catch (e) {
          console.warn("Erro ao salvar endereço no CRM:", e);
        }
      }

      if (orderType === "delivery") {
        
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "delivery",
          status: "preparing", customer_name: customerName || "Cliente PDV",
          customer_cpf: customerCpf || "000.000.000-00",
          delivery_phone: customerPhone,
          delivery_address: deliveryAddress ? `${deliveryAddress}, ${deliveryNeighborhood}, ${deliveryCity}` : null,
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
          coupon_discount: discountAmount > 0 ? discountAmount : null,
          delivery_fee: resolvedDeliveryFeeVal > 0 ? resolvedDeliveryFeeVal : null,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else if (orderType === "retirada") {
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "pickup",
          status: "preparing", customer_name: customerName || "Cliente PDV",
          customer_cpf: customerCpf || "000.000.000-00",
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
          coupon_discount: discountAmount > 0 ? discountAmount : null,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else {
        // Mesa / Balcão
        const tableId = selectedTableId;
        if (!tableId) throw new Error("Selecione uma mesa");
        const table = tables?.find(t => t.id === tableId);
        if (!table) throw new Error("Mesa não encontrada");

        let comandaId: string | null = null;
        const currentCustomerName = customerName || "Cliente PDV";
        const currentCustomerCpf = customerCpf || "000.000.000-00";

        if (table.is_occupied) {
          let query = supabase.from("comandas")
            .select("*").eq("table_id", tableId).eq("status", "active")
            .eq("customer_name", currentCustomerName);
          if (currentCustomerCpf !== "000.000.000-00") {
            query = query.eq("customer_cpf", currentCustomerCpf);
          }
          const { data: existingComanda } = await query
            .order("created_at", { ascending: false }).limit(1).maybeSingle();

          if (existingComanda) {
            comandaId = existingComanda.id;
          } else {
            const { data: nc } = await supabase.from("comandas").insert({
              restaurant_id: restaurantId, table_id: tableId,
              customer_name: currentCustomerName,
              customer_cpf: currentCustomerCpf, status: "active",
            }).select().single();
            comandaId = nc?.id || null;
          }
        } else {
          await supabase.from("tables").update({
            is_occupied: true, occupied_at: new Date().toISOString(),
            occupied_by: currentCustomerName,
          }).eq("id", tableId);
          const { data: nc } = await supabase.from("comandas").insert({
            restaurant_id: restaurantId, table_id: tableId,
            customer_name: currentCustomerName,
            customer_cpf: currentCustomerCpf, status: "active",
          }).select().single();
          comandaId = nc?.id || null;
        }

        // Insert order with null payment_type first (trigger fires on UPDATE)
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "local", table_id: tableId,
          comanda_id: comandaId, status: "pending",
          customer_name: currentCustomerName,
          customer_cpf: currentCustomerCpf,
          notes: notes || null, payment_type: null,
          payment_brand: null,
          coupon_discount: discountAmount > 0 ? discountAmount : null,
          pdv_source: true,
        }).select().single();
        if (error) throw error;

        // Insert items+extras first so trigger sees them
        await insertOrderItems(order.id);

        // Now UPDATE payment_type to fire the add_local_order_to_cash_register trigger
        // If a payment method was selected, mark the order as paid
        if (resolvedPaymentType) {
          await supabase.from("orders").update({
            payment_type: resolvedPaymentType,
            payment_brand: resolvedPaymentBrand,
            payment_status: "paid",
            paid_at: new Date().toISOString(),
          }).eq("id", order.id);
        }

        // Insert employee credit record if payment type is employee_credit
        if (paymentMethod === "employee_credit") {
          await supabase.from("employee_credits").insert({
            restaurant_id: restaurantId,
            employee_name: employeeCreditName || customerName || "Funcionário",
            order_id: order.id,
            amount: cartTotal,
            status: "pending",
            notes: employeeCreditNotes || null,
            created_by: "Sistema PDV",
          });
        }
      }

      // Deduct stock for non-mesa PDV orders
      if (orderType !== "mesa") {
        const lastOrder = await supabase.from("orders")
          .select("id, order_items(id)")
          .eq("restaurant_id", restaurantId)
          .eq("pdv_source", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastOrder.data?.order_items) {
          for (const oi of lastOrder.data.order_items) {
            await supabase.rpc("deduct_stock_for_order_item", { p_order_item_id: oi.id });
          }
        }
      }

      toast.success("Pedido criado com sucesso!");
      clearForm();
      onOpenChange(false);
      onOrderCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
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
          item.extras.map(e => ({ order_item_id: oi.id, product_extra_id: e.extraId, price_at_order: e.price, extra_name: e.name }))
        );
      }
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle>Criar Pedido</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 h-full">
              {/* Left: Form */}
              <div className="p-4 space-y-4 border-r overflow-y-auto max-h-[calc(100vh-180px)]">
                <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="delivery" className="flex-1">Delivery</TabsTrigger>
                    <TabsTrigger value="mesa" className="flex-1">Mesa</TabsTrigger>
                    <TabsTrigger value="retirada" className="flex-1">Retirada</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cliente</Label>
                    <Button variant="ghost" size="sm" onClick={() => setIsCustomerSelectOpen(true)}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Buscar
                    </Button>
                  </div>
                  <Input placeholder="CPF (opcional)" value={customerCpf} onChange={e => {
                    setCustomerCpf(e.target.value);
                    const clean = e.target.value.replace(/\D/g, "");
                    if (clean.length === 11) {
                      supabase.from("customers").select("id, cpf, name, phone").eq("restaurant_id", restaurantId).eq("cpf", e.target.value).maybeSingle()
                        .then(({ data }) => {
                          if (data) {
                            setCustomerName(data.name);
                            setCustomerPhone(data.phone || "");
                          }
                        });
                    }
                  }} />
                  <Input placeholder="Nome do cliente" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  <Input placeholder="Celular" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                </div>

                {/* Type-specific fields */}
                {orderType === "delivery" && (
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input placeholder="CEP" value={deliveryCep} onChange={e => handleCepLookup(e.target.value)} />
                    <Input placeholder="Rua" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                    <Input placeholder="Bairro" value={deliveryNeighborhood} onChange={e => setDeliveryNeighborhood(e.target.value)} />
                    <Input placeholder="Cidade" value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} />
                    
                    <Label>Taxa de Entrega (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={deliveryFee}
                      onChange={e => setDeliveryFee(e.target.value)}
                    />
                    {deliveryFeeAuto !== null && (
                      <p className="text-xs text-muted-foreground">Taxa calculada automaticamente pelo bairro/configuração</p>
                    )}
                    {deliveryFeeAuto === null && !deliveryFee && (
                      <p className="text-xs text-amber-600">Nenhuma configuração de entrega encontrada. Insira manualmente.</p>
                    )}
                  </div>
                )}

                {orderType === "mesa" && (
                  <div className="space-y-2">
                    <Label>Mesa</Label>
                    <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma mesa" /></SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea placeholder="Observações do pedido..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px]" />
                </div>

                {/* Payment */}
                <div className="space-y-2">
                <Label>Pagamento</Label>
                <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); setPaymentBrand(""); }}>
                  <SelectTrigger><SelectValue placeholder="Método de pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="meal_voucher">Vale Refeição</SelectItem>
                  </SelectContent>
                </Select>

                {/* Card brand selection */}
                {(paymentMethod === "credit" || paymentMethod === "debit") && (
                  <Select value={paymentBrand} onValueChange={setPaymentBrand}>
                    <SelectTrigger><SelectValue placeholder="Selecione a bandeira do cartão" /></SelectTrigger>
                    <SelectContent>
                      {paymentMethod === "credit" ? (
                        CARD_BRANDS_PDV.map(b => (
                          <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                        ))
                      ) : (
                        CARD_BRANDS_PDV.filter(b => ["visa", "mastercard", "elo"].includes(b.code)).map(b => (
                          <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}

                {paymentMethod === "meal_voucher" && (
                  <Select value={paymentBrand} onValueChange={setPaymentBrand}>
                    <SelectTrigger><SelectValue placeholder="Selecione a bandeira do vale" /></SelectTrigger>
                    <SelectContent>
                      {VOUCHER_BRANDS_PDV.map(b => (
                        <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                </div>

                {/* Discount */}
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={discountType === "percentage" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDiscountType("percentage")}
                      className="gap-1"
                    >
                      <Percent className="w-3 h-3" /> %
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === "fixed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDiscountType("fixed")}
                      className="gap-1"
                    >
                      <DollarSign className="w-3 h-3" /> R$
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={discountType === "percentage" ? "Ex: 10" : "Ex: 5.00"}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {discountAmount > 0 && (
                    <p className="text-xs text-green-600">Desconto: -R$ {discountAmount.toFixed(2)}</p>
                  )}
                </div>

                {/* Cart Summary */}
                {cart.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <h4 className="font-semibold text-sm">Carrinho ({cart.length})</h4>
                    {cart.map((item, i) => {
                      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
                      const itemTotal = (item.price + extrasTotal) * item.quantity;
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{item.quantity}x</span> {item.productName}
                            {item.extras.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">(+{item.extras.length} extras)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">R$ {itemTotal.toFixed(2)}</span>
                            <Button variant="ghost" size="sm" onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="h-6 w-6 p-0">
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {resolvedDeliveryFeeVal > 0 && (
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Taxa de entrega</span>
                        <span>R$ {resolvedDeliveryFeeVal.toFixed(2)}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-sm text-green-600">
                        <span>Desconto</span>
                        <span>-R$ {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-bold text-sm pt-2 border-t">
                      <span>Total</span>
                      <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Products */}
              <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredProducts.map(product => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedProduct(product); setIsProductDrawerOpen(true); }}
                    >
                      <CardContent className="p-2 space-y-1">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-16 object-cover rounded" />
                        ) : (
                          <div className="w-full h-16 bg-muted rounded flex items-center justify-center text-lg font-bold text-muted-foreground">
                            {product.name.charAt(0)}
                          </div>
                        )}
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        <p className="text-xs font-bold text-primary">R$ {product.price.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex items-center justify-between">
            <div className="text-sm">
              <ShoppingCart className="w-4 h-4 inline mr-1" />
              {cart.length} ite{cart.length !== 1 ? "ns" : "m"} • <span className="font-bold">R$ {cartTotal.toFixed(2)}</span>
            </div>
            <Button onClick={handleSubmit} disabled={submitting || cart.length === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Criar Pedido
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PDVProductDrawer
        product={selectedProduct}
        open={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        onAddToCart={handleAddToCart}
      />

      <CustomerSelectDialog
        restaurantId={restaurantId}
        open={isCustomerSelectOpen}
        onOpenChange={setIsCustomerSelectOpen}
        onSelect={handleCustomerSelect}
      />
    </>
  );
};
