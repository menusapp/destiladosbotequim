import { useState, useMemo } from "react";
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
import { Search, Trash2, ShoppingCart, UserPlus, X, Loader2, Plus, CreditCard } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { CustomerSelectDialog } from "./CustomerSelectDialog";

interface MixedPaymentEntry {
  id: string;
  method: string;
  brand?: string;
  amount: string;
}

const MIXED_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
  { value: "meal_voucher", label: "Vale Refeição" },
];

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
  const [mixedPayments, setMixedPayments] = useState<MixedPaymentEntry[]>([
    { id: crypto.randomUUID(), method: "", brand: "", amount: "" },
    { id: crypto.randomUUID(), method: "", brand: "", amount: "" },
  ]);

  const { data: products } = useQuery({
    queryKey: ["products-create-order", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!inner(id, name, restaurant_id), product_extras(*)")
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

  const handleAddToCart = (item: CartItem) => {
    setCart(prev => [...prev, item]);
    toast.success(`${item.productName} adicionado!`);
  };

  const handleCustomerSelect = (customer: { id: string; cpf: string; name: string; phone: string | null }) => {
    setCustomerName(customer.name);
    setCustomerCpf(customer.cpf);
    setCustomerPhone(customer.phone || "");
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
    setMixedPayments([
      { id: crypto.randomUUID(), method: "", brand: "", amount: "" },
      { id: crypto.randomUUID(), method: "", brand: "", amount: "" },
    ]);
  };

  const getMixedPaymentString = (): { paymentStr: string; brandCode: string | null } => {
    const valid = mixedPayments.filter(p => p.method && parseFloat(p.amount) > 0);
    if (valid.length === 0) return { paymentStr: "", brandCode: null };

    const labels = valid.map(p => {
      const methodLabel = MIXED_METHODS.find(m => m.value === p.method)?.label || p.method;
      if (p.brand) {
        const allBrands = [...CARD_BRANDS_PDV, ...VOUCHER_BRANDS_PDV];
        const brandName = allBrands.find(b => b.code === p.brand)?.name || p.brand;
        return `${methodLabel} - ${brandName}`;
      }
      return methodLabel;
    });

    const firstBrand = valid.find(p => p.brand)?.brand || null;
    return { paymentStr: labels.join(", "), brandCode: firstBrand };
  };

  const mixedTotal = useMemo(() => {
    return mixedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [mixedPayments]);

  const mixedRemaining = Math.max(0, Math.round((cartSubtotal - mixedTotal) * 100) / 100);

  const needsBrandForMethod = (method: string) => ["credit", "debit", "meal_voucher"].includes(method);

  const getBrandsForMixedMethod = (method: string) => {
    if (method === "credit" || method === "debit") return CARD_BRANDS_PDV;
    if (method === "meal_voucher") return VOUCHER_BRANDS_PDV;
    return [];
  };

  const updateMixedPayment = (id: string, field: keyof MixedPaymentEntry, value: string) => {
    setMixedPayments(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (field === "method") updated.brand = "";
      return updated;
    }));
  };

  const addMixedPayment = () => {
    setMixedPayments(prev => [...prev, { id: crypto.randomUUID(), method: "", brand: "", amount: "" }]);
  };

  const removeMixedPayment = (id: string) => {
    if (mixedPayments.length <= 2) return;
    setMixedPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error("Adicione produtos ao carrinho"); return; }
    if (!customerName && orderType !== "mesa") { toast.error("Nome do cliente é obrigatório"); return; }

    // Resolve payment type
    let resolvedPaymentType: string | null = null;
    let resolvedPaymentBrand: string | null = null;

    if (paymentMethod === "mixed") {
      const validEntries = mixedPayments.filter(p => p.method && parseFloat(p.amount) > 0);
      if (validEntries.length < 2) { toast.error("Pagamento misto requer pelo menos 2 formas"); return; }
      if (mixedRemaining > 0.01) { toast.error(`Faltam R$ ${mixedRemaining.toFixed(2)} para completar o valor`); return; }
      const { paymentStr, brandCode } = getMixedPaymentString();
      resolvedPaymentType = paymentStr;
      resolvedPaymentBrand = brandCode;
    } else if (paymentMethod === "credit" || paymentMethod === "debit") {
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
    } else if (paymentMethod) {
      resolvedPaymentType = paymentMethod;
    }

    setSubmitting(true);
    try {
      if (orderType === "delivery") {
        if (!customerPhone) throw new Error("Telefone é obrigatório para delivery");
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "delivery",
          status: "preparing", customer_name: customerName,
          customer_cpf: customerCpf || "000.000.000-00",
          delivery_phone: customerPhone,
          delivery_address: deliveryAddress ? `${deliveryAddress}, ${deliveryNeighborhood}, ${deliveryCity}` : null,
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else if (orderType === "retirada") {
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "pickup",
          status: "preparing", customer_name: customerName,
          customer_cpf: customerCpf || "000.000.000-00",
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
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
          // Search for an existing comanda for THIS SPECIFIC customer (by name AND cpf)
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
            // Create a NEW comanda for this different customer
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

        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "local", table_id: tableId,
          comanda_id: comandaId, status: "pending",
          customer_name: currentCustomerName,
          customer_cpf: currentCustomerCpf,
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);
      }

      // Deduct stock for non-mesa PDV orders (start in 'preparing', trigger misses items)
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
          item.extras.map(e => ({ order_item_id: oi.id, product_extra_id: e.extraId, price_at_order: e.price }))
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

                {/* Customer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cliente</Label>
                    <Button variant="ghost" size="sm" onClick={() => setIsCustomerSelectOpen(true)}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Buscar
                    </Button>
                  </div>
                  <Input placeholder="Nome do cliente" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  {(orderType === "delivery") && (
                    <Input placeholder="Telefone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                  )}
                  <Input placeholder="CPF (opcional)" value={customerCpf} onChange={e => setCustomerCpf(e.target.value)} />
                </div>

                {/* Type-specific fields */}
                {orderType === "delivery" && (
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input placeholder="CEP" value={deliveryCep} onChange={e => handleCepLookup(e.target.value)} />
                    <Input placeholder="Rua" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                    <Input placeholder="Bairro" value={deliveryNeighborhood} onChange={e => setDeliveryNeighborhood(e.target.value)} />
                    <Input placeholder="Cidade" value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} />
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
                <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); setPaymentBrand(""); if (v !== "mixed") setMixedPayments([{ id: crypto.randomUUID(), method: "", brand: "", amount: "" }, { id: crypto.randomUUID(), method: "", brand: "", amount: "" }]); }}>
                  <SelectTrigger><SelectValue placeholder="Método de pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="meal_voucher">Vale Refeição</SelectItem>
                    <SelectItem value="mixed">Misto (2+ formas)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Card brand selection for single method */}
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

                {/* Mixed payment UI */}
                {paymentMethod === "mixed" && (
                  <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Formas de pagamento</span>
                      {mixedRemaining > 0.01 ? (
                        <Badge variant="destructive" className="text-xs">Falta: R$ {mixedRemaining.toFixed(2)}</Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white text-xs">✓ Completo</Badge>
                      )}
                    </div>

                    {mixedPayments.map((entry, idx) => (
                      <div key={entry.id} className="space-y-1.5 border rounded-md p-2 bg-background">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
                          <Select value={entry.method} onValueChange={(v) => updateMixedPayment(entry.id, "method", v)}>
                            <SelectTrigger className="flex-1 h-9 text-sm">
                              <SelectValue placeholder="Forma..." />
                            </SelectTrigger>
                            <SelectContent>
                              {MIXED_METHODS.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={entry.amount}
                              onChange={(e) => updateMixedPayment(entry.id, "amount", e.target.value)}
                              placeholder="0,00"
                              className="pl-7 h-9 text-sm"
                            />
                          </div>
                          {mixedPayments.length > 2 && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeMixedPayment(entry.id)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Brand selector for card/voucher methods */}
                        {needsBrandForMethod(entry.method) && (
                          <div className="ml-7">
                            <Select value={entry.brand || ""} onValueChange={(v) => updateMixedPayment(entry.id, "brand", v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione a bandeira" />
                              </SelectTrigger>
                              <SelectContent>
                                {getBrandsForMixedMethod(entry.method).map(b => (
                                  <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))}

                    <Button variant="outline" size="sm" className="w-full" onClick={addMixedPayment}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar forma
                    </Button>

                    <div className="flex justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">Total informado:</span>
                      <span className={`font-bold ${mixedRemaining > 0.01 ? "text-destructive" : "text-green-600"}`}>
                        R$ {mixedTotal.toFixed(2)} / R$ {cartSubtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
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
                    <div className="flex items-center justify-between font-bold text-sm pt-2 border-t">
                      <span>Total</span>
                      <span>R$ {cartSubtotal.toFixed(2)}</span>
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
              {cart.length} ite{cart.length !== 1 ? "ns" : "m"} • <span className="font-bold">R$ {cartSubtotal.toFixed(2)}</span>
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
