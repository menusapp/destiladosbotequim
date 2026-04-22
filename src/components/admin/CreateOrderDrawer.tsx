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
import { validateCPF } from "@/lib/cpfValidator";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { CustomerSelectDialog } from "./CustomerSelectDialog";
import { notifyOrderAcceptedFromPDV } from "@/lib/pdvNotifications";

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

const normalizeZoneText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeCityName = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw) return "";
  return normalizeZoneText(raw.split(" - ")[0]);
};

const findMatchingDeliveryZone = ({
  orderType,
  deliveryCep,
  deliveryNeighborhood,
  deliveryCity,
  deliveryAddress,
  zones,
}: {
  orderType: "delivery" | "mesa" | "retirada";
  deliveryCep: string;
  deliveryNeighborhood: string;
  deliveryCity: string;
  deliveryAddress: string;
  zones?: any[] | null;
}) => {
  if (orderType !== "delivery" || !zones?.length) return null;

  const cleanCep = deliveryCep.replace(/\D/g, "");
  const normalizedNeighborhood = normalizeZoneText(deliveryNeighborhood);
  const normalizedCity = normalizeCityName(deliveryCity);
  const normalizedAddress = normalizeZoneText(
    [deliveryAddress, deliveryNeighborhood, deliveryCity].filter(Boolean).join(" ")
  );

  if (cleanCep.length >= 5) {
    const cepMatches = zones.flatMap((zone) =>
      (zone.zip_codes || [])
        .map((zipCode: string) => ({
          zone,
          prefix: (zipCode || "").replace(/\D/g, ""),
        }))
        .filter(({ prefix }: { prefix: string }) => prefix && cleanCep.startsWith(prefix))
    );

    if (cepMatches.length > 0) {
      return cepMatches.sort((a, b) => b.prefix.length - a.prefix.length)[0].zone;
    }
  }

  if (normalizedNeighborhood) {
    const neighborhoodZone = zones.find((zone) =>
      zone.neighborhoods?.some((neighborhood: string) => {
        const target = normalizeZoneText(neighborhood);
        return target && (
          normalizedNeighborhood.includes(target) ||
          target.includes(normalizedNeighborhood)
        );
      })
    );
    if (neighborhoodZone) return neighborhoodZone;
  }

  if (normalizedCity) {
    const cityZone = zones.find((zone) => {
      const zoneName = normalizeZoneText(zone.zone_name);
      return zoneName && (
        zoneName === normalizedCity ||
        normalizedAddress.includes(zoneName)
      );
    });
    if (cityZone) return cityZone;
  }

  return null;
};

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
  const [foundCustomer, setFoundCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
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

  const matchedZone = useMemo(() => findMatchingDeliveryZone({
    orderType,
    deliveryCep,
    deliveryNeighborhood,
    deliveryCity,
    deliveryAddress,
    zones: deliveryZones,
  }), [deliveryZones, deliveryAddress, deliveryCep, deliveryNeighborhood, deliveryCity, orderType]);

  const resolvedDeliveryFeeVal = orderType === "delivery"
    ? Number(matchedZone?.delivery_fee ?? (parseFloat(deliveryFee) || deliveryFeeAuto || deliveryConfig?.delivery_fee || 0))
    : 0;
  const cartTotal = cartSubtotal - discountAmount + resolvedDeliveryFeeVal;
  const hasValidCustomer = customerName.trim().length > 0;

  const minOrderValue = Number(matchedZone?.min_order_value ?? deliveryConfig?.min_order_value ?? 0);
  const belowMinimum = orderType === "delivery" && minOrderValue > 0 && cartSubtotal > 0 && cartSubtotal < minOrderValue;

  useEffect(() => {
    if (orderType !== "delivery") {
      setDeliveryFeeAuto(null);
      return;
    }

    if (matchedZone) {
      const zoneFee = Number(matchedZone.delivery_fee ?? 0);
      setDeliveryFeeAuto(zoneFee);
      setDeliveryFee(zoneFee.toFixed(2));
      return;
    }

    if (deliveryConfig?.delivery_fee !== null && deliveryConfig?.delivery_fee !== undefined) {
      setDeliveryFeeAuto(deliveryConfig.delivery_fee);
      setDeliveryFee(Number(deliveryConfig.delivery_fee).toFixed(2));
    } else {
      setDeliveryFeeAuto(null);
      setDeliveryFee("");
    }
  }, [matchedZone, deliveryConfig, orderType]);

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
      setDeliveryAddress(customer.defaultAddress.street || "");
      setDeliveryNumber(customer.defaultAddress.number || "");
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
    setCustomerName(""); setCustomerPhone(""); setCustomerCpf(""); setFoundCustomer(null);
    setDeliveryAddress(""); setDeliveryNumber(""); setDeliveryCep(""); setDeliveryNeighborhood(""); setDeliveryCity("");
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
    if (!customerName.trim()) {
      toast.error("Informe ao menos o nome do cliente");
      return;
    }
    if (cart.length === 0) { toast.error("Adicione produtos ao carrinho"); return; }

    // Validate delivery address for delivery orders
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("Informe o endereço de entrega");
      return;
    }

    // Block when delivery zone is configured but address doesn't match any zone
    if (orderType === "delivery" && (deliveryZones?.length ?? 0) > 0 && !matchedZone) {
      toast.error(
        "Endereço fora das regiões de entrega cadastradas. Verifique CEP/bairro ou cadastre a região."
      );
      return;
    }

    // Enforce minimum order value for the matched delivery zone
    if (belowMinimum) {
      toast.error(
        `Pedido mínimo para essa região: R$ ${minOrderValue.toFixed(2)}. Subtotal atual: R$ ${cartSubtotal.toFixed(2)}.`
      );
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
      if (orderType === "delivery" && deliveryAddress) {
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
              customer_name: customerName.trim(),
              customer_phone: customerPhone || "",
              street: deliveryAddress,
              number: deliveryNumber || "S/N",
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
        // Resolve city: use typed city, or fallback to matched delivery zone name
        const resolvedCity = (deliveryCity || matchedZone?.zone_name || "").trim();

        // Build complete address: Cidade - Rua, Número - Bairro - CEP
        const fullAddressParts: string[] = [];
        if (resolvedCity) fullAddressParts.push(resolvedCity);
        if (deliveryAddress) {
          fullAddressParts.push(
            deliveryNumber ? `${deliveryAddress}, ${deliveryNumber}` : deliveryAddress
          );
        }
        if (deliveryNeighborhood) fullAddressParts.push(deliveryNeighborhood);
        if (deliveryCep) fullAddressParts.push(`CEP ${deliveryCep}`);
        const fullAddress = fullAddressParts.join(" - ");

        // Garante que a taxa de entrega seja persistida: prioriza valor digitado,
        // depois valor auto da zona, depois config padrão. Sempre número (não null).
        const finalDeliveryFee = Number(
          resolvedDeliveryFeeVal ||
          deliveryFeeAuto ||
          matchedZone?.delivery_fee ||
          deliveryConfig?.delivery_fee ||
          0
        );

        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "delivery",
          status: "preparing", customer_name: customerName.trim(),
          customer_cpf: customerCpf,
          delivery_phone: customerPhone,
          delivery_address: fullAddress || null,
          delivery_city: resolvedCity || null,
          delivery_neighborhood: deliveryNeighborhood || null,
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
          coupon_discount: discountAmount > 0 ? discountAmount : null,
          delivery_fee: finalDeliveryFee,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

        // Trigger WhatsApp "order accepted" notification (PDV delivery)
        notifyOrderAcceptedFromPDV({
          restaurantId,
          orderId: order.id,
          customerName: customerName.trim(),
          customerPhone,
        });

      } else if (orderType === "retirada") {
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "pickup",
          status: "preparing", customer_name: customerName.trim(),
          customer_cpf: customerCpf,
          notes: notes || null, payment_type: resolvedPaymentType,
          payment_brand: resolvedPaymentBrand,
          coupon_discount: discountAmount > 0 ? discountAmount : null,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

        // Trigger WhatsApp "order accepted" notification (PDV pickup)
        notifyOrderAcceptedFromPDV({
          restaurantId,
          orderId: order.id,
          customerName: customerName.trim(),
          customerPhone,
        });

      } else {
        // Mesa / Balcão
        const tableId = selectedTableId;
        if (!tableId) throw new Error("Selecione uma mesa");
        const table = tables?.find(t => t.id === tableId);
        if (!table) throw new Error("Mesa não encontrada");

        let comandaId: string | null = null;
        const currentCustomerName = customerName.trim();
        const currentCustomerCpf = customerCpf;

        if (table.is_occupied) {
          const { data: existingComanda } = await supabase.from("comandas")
            .select("*").eq("table_id", tableId).eq("status", "active")
            .eq("customer_name", currentCustomerName)
            .eq("customer_cpf", currentCustomerCpf)
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

        // Insert order already accepted (PDV orders skip pending stage)
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "local", table_id: tableId,
          comanda_id: comandaId, status: "accepted",
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

        // Trigger WhatsApp "order accepted" notification (lookup phone by CPF in CRM)
        try {
          let phoneForNotify: string | null = null;
          if (currentCustomerCpf) {
            const { data: cust } = await supabase
              .from("customers")
              .select("phone")
              .eq("restaurant_id", restaurantId)
              .eq("cpf", currentCustomerCpf)
              .maybeSingle();
            phoneForNotify = cust?.phone || null;
          }
          if (phoneForNotify) {
            notifyOrderAcceptedFromPDV({
              restaurantId,
              orderId: order.id,
              customerName: currentCustomerName,
              customerPhone: phoneForNotify,
            });
          }
        } catch {}

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
        // Stock deduction is handled by DB trigger on status change to delivered/picked_up
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
                  <Input placeholder="CPF do cliente" value={customerCpf} maxLength={14} inputMode="numeric" onChange={e => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let formatted = d;
                    if (d.length > 9) formatted = `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
                    else if (d.length > 6) formatted = `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
                    else if (d.length > 3) formatted = `${d.slice(0,3)}.${d.slice(3)}`;
                    setCustomerCpf(formatted);
                    if (d.length === 11) {
                      supabase.from("customers").select("id, cpf, name, phone").eq("restaurant_id", restaurantId).eq("cpf", d).maybeSingle()
                        .then(async ({ data }) => {
                          if (!data) { setFoundCustomer(null); return; }
                          // Auto-fill any missing fields without clearing existing data
                          if (!customerName.trim()) setCustomerName(data.name);
                          if (!customerPhone.trim() && data.phone) {
                            const dp = data.phone.replace(/\D/g, "").slice(0, 11);
                            let f = dp;
                            if (dp.length > 10) f = `(${dp.slice(0,2)}) ${dp.slice(2,7)}-${dp.slice(7)}`;
                            else if (dp.length > 6) f = `(${dp.slice(0,2)}) ${dp.slice(2,6)}-${dp.slice(6)}`;
                            else if (dp.length > 2) f = `(${dp.slice(0,2)}) ${dp.slice(2)}`;
                            setCustomerPhone(f);
                          }
                          setFoundCustomer({ name: data.name, phone: data.phone || "" });
                          // Auto-fill address if delivery and no address yet
                          if (orderType === "delivery" && !deliveryAddress.trim()) {
                            const { data: addr } = await supabase
                              .from("customer_addresses")
                              .select("*")
                              .eq("customer_cpf", d)
                              .order("is_default", { ascending: false })
                              .limit(1)
                              .maybeSingle();
                            if (addr) {
                              setDeliveryAddress(addr.street || "");
                              setDeliveryNumber(addr.number || "");
                              setDeliveryCep(addr.zip_code || "");
                              setDeliveryNeighborhood(addr.neighborhood || "");
                              setDeliveryCity(addr.city ? `${addr.city}${addr.state ? ` - ${addr.state}` : ""}` : "");
                            }
                          }
                        });
                    } else {
                      setFoundCustomer(null);
                    }
                  }} />
                  {foundCustomer && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-primary/30 bg-primary/5 text-xs">
                      <span className="text-foreground">
                        Cliente já cadastrado: <strong>{foundCustomer.name}</strong>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setCustomerName(foundCustomer.name);
                          setCustomerPhone(foundCustomer.phone);
                          setFoundCustomer(null);
                        }}
                      >
                        Preencher
                      </Button>
                    </div>
                  )}
                  <Input placeholder="Nome do cliente *" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  <Input placeholder="Celular do cliente" value={customerPhone} maxLength={15} inputMode="tel" onChange={e => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let f = d;
                    if (d.length > 10) f = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
                    else if (d.length > 6) f = `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
                    else if (d.length > 2) f = `(${d.slice(0,2)}) ${d.slice(2)}`;
                    setCustomerPhone(f);
                    // Auto-lookup by phone (10-11 digits)
                    if (d.length >= 10) {
                      supabase.from("customers").select("id, cpf, name, phone").eq("restaurant_id", restaurantId).eq("phone", f).maybeSingle()
                        .then(async ({ data }) => {
                          if (!data) return;
                          if (!customerName.trim()) setCustomerName(data.name);
                          if (!customerCpf.trim() && data.cpf) {
                            const dc = data.cpf.replace(/\D/g, "");
                            let cf = dc;
                            if (dc.length === 11) cf = `${dc.slice(0,3)}.${dc.slice(3,6)}.${dc.slice(6,9)}-${dc.slice(9)}`;
                            setCustomerCpf(cf);
                          }
                          setFoundCustomer({ name: data.name, phone: data.phone || "" });
                          if (orderType === "delivery" && !deliveryAddress.trim() && data.cpf) {
                            const cleanCpf = data.cpf.replace(/\D/g, "");
                            const { data: addr } = await supabase
                              .from("customer_addresses")
                              .select("*")
                              .eq("customer_cpf", cleanCpf)
                              .order("is_default", { ascending: false })
                              .limit(1)
                              .maybeSingle();
                            if (addr) {
                              setDeliveryAddress(addr.street || "");
                              setDeliveryNumber(addr.number || "");
                              setDeliveryCep(addr.zip_code || "");
                              setDeliveryNeighborhood(addr.neighborhood || "");
                              setDeliveryCity(addr.city ? `${addr.city}${addr.state ? ` - ${addr.state}` : ""}` : "");
                            }
                          }
                        });
                    }
                  }} />
                  {!hasValidCustomer && (
                    <p className="text-xs text-muted-foreground">
                      Informe ao menos o nome do cliente para liberar o pedido.
                    </p>
                  )}
                </div>

                {/* Type-specific fields */}
                {orderType === "delivery" && (
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input placeholder="CEP" value={deliveryCep} onChange={e => handleCepLookup(e.target.value)} />
                    <div className="grid grid-cols-[1fr_100px] gap-2">
                      <Input placeholder="Rua" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                      <Input placeholder="Número" value={deliveryNumber} onChange={e => setDeliveryNumber(e.target.value)} />
                    </div>
                    <Input placeholder="Bairro" value={deliveryNeighborhood} onChange={e => setDeliveryNeighborhood(e.target.value)} />
                    <Input placeholder="Cidade" value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} />
                    
                    {orderType === "delivery" && (deliveryZones?.length ?? 0) > 0 && (deliveryCep || deliveryNeighborhood) && !matchedZone && (
                      <div className="p-3 rounded border border-destructive/40 bg-destructive/10 text-xs text-destructive">
                        ⚠ Endereço fora das regiões de entrega cadastradas.
                      </div>
                    )}
                    {matchedZone && (
                      <div className="p-3 rounded border border-primary/30 bg-primary/5 text-xs">
                        Região: <strong>{matchedZone.zone_name}</strong>
                        {Number(matchedZone.min_order_value ?? 0) > 0 && (
                          <> · Pedido mínimo: <strong>R$ {Number(matchedZone.min_order_value).toFixed(2)}</strong></>
                        )}
                      </div>
                    )}
                    {belowMinimum && (
                      <div className="p-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
                        Subtotal abaixo do mínimo da região (R$ {minOrderValue.toFixed(2)}).
                      </div>
                    )}

                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded border">
                      <span className="text-sm font-medium">Taxa de entrega</span>
                      {deliveryFeeAuto !== null ? (
                        <span className="font-medium text-green-600">
                          {deliveryFeeAuto === 0 ? 'Grátis' : `R$ ${deliveryFeeAuto.toFixed(2)}`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem zona configurada</span>
                      )}
                    </div>

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
                      <p className="text-xs text-muted-foreground">Taxa calculada automaticamente por CEP/bairro/configuração</p>
                    )}
                    {deliveryFeeAuto === null && !deliveryFee && (
                      <p className="text-xs text-amber-600">CEP/bairro fora da área cadastrada. Insira a taxa manualmente.</p>
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
                    <SelectItem value="employee_credit">Crédito de Funcionário</SelectItem>
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

                {/* Employee Credit Fields */}
                {paymentMethod === "employee_credit" && (
                  <div className="space-y-2 border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Este pedido será lançado como crédito pendente. O funcionário deverá quitar posteriormente.
                    </div>
                    <div>
                      <Label className="text-xs">Nome do Funcionário *</Label>
                      <Input
                        placeholder="Nome do funcionário"
                        value={employeeCreditName}
                        onChange={e => setEmployeeCreditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Observação</Label>
                      <Input
                        placeholder="Observação (opcional)"
                        value={employeeCreditNotes}
                        onChange={e => setEmployeeCreditNotes(e.target.value)}
                      />
                    </div>
                  </div>
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
                    {belowMinimum && (
                      <div className="flex items-start gap-2 p-2 mt-2 rounded border border-destructive/40 bg-destructive/10 text-destructive text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          Pedido mínimo desta região: <strong>R$ {minOrderValue.toFixed(2)}</strong>. Adicione mais itens para liberar.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Products */}
              <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                <div className="min-h-[300px]">
                  {(() => {
                    const categoryMap = new Map<string, { name: string; products: typeof filteredProducts }>();
                    const uncategorized: typeof filteredProducts = [];
                    
                    filteredProducts.forEach(product => {
                      const cat = (product as any).categories;
                      if (cat?.id) {
                        if (!categoryMap.has(cat.id)) {
                          categoryMap.set(cat.id, { name: cat.name, products: [] });
                        }
                        categoryMap.get(cat.id)!.products.push(product);
                      } else {
                        uncategorized.push(product);
                      }
                    });

                    const categoriesArr = Array.from(categoryMap.entries());

                    const renderProduct = (product: any) => (
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
                    );

                    return (
                      <>
                        {categoriesArr.map(([catId, { name, products: catProducts }]) => (
                          <div key={catId} className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 bg-muted/50 rounded mb-2 sticky top-0 z-10">
                              {name}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {catProducts.map(renderProduct)}
                            </div>
                          </div>
                        ))}
                        {uncategorized.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 bg-muted/50 rounded mb-2">
                              Outros
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {uncategorized.map(renderProduct)}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
            <Button onClick={handleSubmit} disabled={submitting || cart.length === 0 || !hasValidCustomer || belowMinimum}>
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
