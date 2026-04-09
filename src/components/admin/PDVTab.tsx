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
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Search, ShoppingCart, UserPlus, X, Loader2, Settings,
  MoreVertical, QrCode, Link2, Eraser, Eye, EyeOff, MapPin, Plus,
  ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Printer } from "lucide-react";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { printOrder } from "@/lib/printOrder";
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
  is_hidden: boolean;
  comandas?: { id: string; customer_name: string; customer_cpf: string }[];
}

interface SelectedCustomer {
  name: string;
  cpf: string;
  phone: string;
}

interface SelectedAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface PDVTabProps {
  restaurantId: string;
  pendingTableToOpen?: string | null;
  onTableOpened?: () => void;
  showPrepTimer?: boolean;
}

const PDVTab = ({ restaurantId, pendingTableToOpen, onTableOpened, showPrepTimer = true }: PDVTabProps) => {
  const queryClient = useQueryClient();

  // Order creation state
  const [orderType, setOrderType] = useState<"mesa" | "delivery" | "retirada">("mesa");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderSearchDate, setOrderSearchDate] = useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Customer fields (source of truth for submit)
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

  // New UX states
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientCpf, setNewClientCpf] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [savingNewClient, setSavingNewClient] = useState(false);

  // Address UX states
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddrCep, setNewAddrCep] = useState("");
  const [newAddrStreet, setNewAddrStreet] = useState("");
  const [newAddrNumber, setNewAddrNumber] = useState("");
  const [newAddrComplement, setNewAddrComplement] = useState("");
  const [newAddrNeighborhood, setNewAddrNeighborhood] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrState, setNewAddrState] = useState("");

  // Discount states
  const [discountExpanded, setDiscountExpanded] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "value">("value");
  const [discountTarget, setDiscountTarget] = useState("total");
  const [discountValue, setDiscountValue] = useState("");
  const [discountNotes, setDiscountNotes] = useState("");

  // Employee credit states
  const [employeeCreditName, setEmployeeCreditName] = useState("");
  const [employeeCreditNotes, setEmployeeCreditNotes] = useState("");
  const [employeeNameSuggestions, setEmployeeNameSuggestions] = useState<string[]>([]);

  // Auto-print toggle
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("pdv_auto_print") === "true");

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

  // Fetch pending local orders per table (for "Pedido Novo" badge)
  const { data: pendingLocalOrders, refetch: refetchPendingOrders } = useQuery({
    queryKey: ["pdv-pending-local-orders", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, table_id, customer_name, order_items(id)")
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "local")
        .eq("status", "pending");
      return data || [];
    },
  });

  // Fetch ALL active local orders per table (for permanent preview)
  const { data: activeLocalOrders, refetch: refetchActiveOrders } = useQuery({
    queryKey: ["pdv-active-local-orders", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, table_id, customer_name, order_items(id)")
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "local")
        .in("status", ["pending", "accepted", "preparing", "ready"]);
      return data || [];
    },
  });

  // Fetch searchable orders with items and table info
  const { data: searchableOrders } = useQuery({
    queryKey: ["pdv-searchable-orders", restaurantId, orderSearchDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, status, customer_name, customer_cpf, table_id, created_at, order_items(id, quantity, products(name)), tables(table_number, table_name)")
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "local");

      if (orderSearchDate) {
        query = query
          .gte("created_at", startOfDay(orderSearchDate).toISOString())
          .lte("created_at", endOfDay(orderSearchDate).toISOString());
      } else {
        query = query.in("status", ["pending", "accepted", "preparing", "ready", "delivered"]);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Group pending orders by table_id (for badge only)
  const pendingByTable = useMemo(() => {
    const map = new Map<string, number>();
    pendingLocalOrders?.forEach(order => {
      if (!order.table_id) return;
      map.set(order.table_id, (map.get(order.table_id) || 0) + 1);
    });
    return map;
  }, [pendingLocalOrders]);

  // Group ALL active orders by table_id (for permanent preview)
  const activeByTable = useMemo(() => {
    const map = new Map<string, { customerNames: string[]; itemCount: number }>();
    activeLocalOrders?.forEach(order => {
      if (!order.table_id) return;
      const existing = map.get(order.table_id) || { customerNames: [], itemCount: 0 };
      if (order.customer_name && !existing.customerNames.includes(order.customer_name)) {
        existing.customerNames.push(order.customer_name);
      }
      existing.itemCount += order.order_items?.length || 0;
      map.set(order.table_id, existing);
    });
    return map;
  }, [activeLocalOrders]);

  // Filter searchable orders based on search term and/or date
  const filteredOrders = useMemo(() => {
    if (!searchableOrders) return [];
    if (orderSearchDate && orderSearchTerm.length < 2) return searchableOrders;
    if (orderSearchTerm.length < 2) return [];
    const term = orderSearchTerm.toLowerCase();
    return searchableOrders.filter((order: any) => {
      if (order.customer_name?.toLowerCase().includes(term)) return true;
      if (order.customer_cpf?.includes(term)) return true;
      if (order.order_items?.some((item: any) => item.products?.name?.toLowerCase().includes(term))) return true;
      return false;
    });
  }, [searchableOrders, orderSearchTerm, orderSearchDate]);

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

  // Fetch today's confirmed reservations for table badges
  const { data: todayReservations } = useQuery({
    queryKey: ["pdv-today-reservations", restaurantId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("reservations")
        .select("id, table_id, reservation_time, customer_name, status")
        .eq("restaurant_id", restaurantId)
        .eq("reservation_date", today)
        .eq("status", "confirmed");
      return data || [];
    },
  });

  // Map table_id → reservation info for today
  const reservationByTable = useMemo(() => {
    const map = new Map<string, { time: string; customerName: string }>();
    todayReservations?.forEach(r => {
      if (r.table_id) {
        map.set(r.table_id, { 
          time: r.reservation_time?.slice(0, 5) || "", 
          customerName: r.customer_name 
        });
      }
    });
    return map;
  }, [todayReservations]);

  // Realtime for tables and orders
  useEffect(() => {
    const ch = supabase.channel("pdv-tables-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => refetchTables())
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, () => refetchTables())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { refetchPendingOrders(); refetchActiveOrders(); queryClient.invalidateQueries({ queryKey: ["pdv-searchable-orders"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetchTables, refetchPendingOrders, refetchActiveOrders, queryClient]);

  // Auto-open table from notification
  useEffect(() => {
    if (pendingTableToOpen && tables) {
      const table = tables.find(t => t.id === pendingTableToOpen);
      if (table) {
        setSelectedTableForDrawer(table);
        onTableOpened?.();
      }
    }
  }, [pendingTableToOpen, tables]);

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

  // Calculated discount
  const calculatedDiscount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) return 0;
    if (discountType === "percentage") {
      if (discountTarget === "total") {
        const pct = Math.min(val, 100);
        return Math.min(cartSubtotal * (pct / 100), cartSubtotal);
      } else {
        const item = cart.find(c => c.productId === discountTarget);
        if (!item) return 0;
        const itemTotal = (item.price + item.extras.reduce((s, e) => s + e.price, 0)) * item.quantity;
        const pct = Math.min(val, 100);
        return Math.min(itemTotal * (pct / 100), itemTotal);
      }
    } else {
      if (discountTarget === "total") {
        return Math.min(val, cartSubtotal);
      } else {
        const item = cart.find(c => c.productId === discountTarget);
        if (!item) return 0;
        const itemTotal = (item.price + item.extras.reduce((s, e) => s + e.price, 0)) * item.quantity;
        return Math.min(val, itemTotal);
      }
    }
  }, [discountType, discountValue, discountTarget, cartSubtotal, cart]);

  const cartTotal = cartSubtotal - calculatedDiscount;

  const handleAddToCart = (item: CartItem) => {
    setCart(prev => [...prev, item]);
    toast.success(`${item.productName} adicionado!`);
  };

  // Sync selectedCustomer to source-of-truth states
  const applyCustomer = (c: SelectedCustomer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerCpf(c.cpf);
    setCustomerPhone(c.phone);
    setShowNewClientForm(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName("");
    setCustomerCpf("");
    setCustomerPhone("");
    setSelectedAddress(null);
    setDeliveryAddress("");
    setDeliveryCep("");
    setDeliveryNeighborhood("");
    setDeliveryCity("");
  };

  const applyAddress = (addr: SelectedAddress) => {
    setSelectedAddress(addr);
    setDeliveryAddress(`${addr.street}${addr.number ? `, ${addr.number}` : ""}`);
    setDeliveryCep(addr.zip_code);
    setDeliveryNeighborhood(addr.neighborhood);
    setDeliveryCity(`${addr.city} - ${addr.state}`);
  };

  const handleCustomerSelect = (customer: { id: string; cpf: string; name: string; phone: string | null; defaultAddress?: any }) => {
    applyCustomer({ name: customer.name, cpf: customer.cpf, phone: customer.phone || "" });
    // Auto-fill address if delivery and address available
    if (customer.defaultAddress && orderType === "delivery") {
      applyAddress({
        street: customer.defaultAddress.street,
        number: customer.defaultAddress.number || "",
        complement: customer.defaultAddress.complement || "",
        neighborhood: customer.defaultAddress.neighborhood || "",
        city: customer.defaultAddress.city || "",
        state: customer.defaultAddress.state || "",
        zip_code: customer.defaultAddress.zip_code || "",
      });
    }
  };

  const handleCepLookup = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        return { street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" };
      }
    } catch { /* ignore */ }
    return null;
  };

  const handleSaveNewClient = async () => {
    if (!newClientName.trim()) { toast.error("Nome é obrigatório"); return; }
    setSavingNewClient(true);
    try {
      const cpf = newClientCpf.replace(/\D/g, "");
      const finalCpf = cpf.length >= 11 ? newClientCpf : "000.000.000-00";

      if (cpf.length >= 11) {
        const { data: existing } = await supabase
          .from("customers").select("id").eq("restaurant_id", restaurantId).eq("cpf", newClientCpf).maybeSingle();
        if (existing) {
          await supabase.from("customers").update({ name: newClientName, phone: newClientPhone || null }).eq("id", existing.id);
        } else {
          await supabase.from("customers").insert({ restaurant_id: restaurantId, cpf: finalCpf, name: newClientName, phone: newClientPhone || null });
        }
      }

      applyCustomer({ name: newClientName, cpf: finalCpf, phone: newClientPhone });
      setNewClientCpf("");
      setNewClientName("");
      setNewClientPhone("");
      toast.success("Cliente salvo!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar cliente");
    } finally {
      setSavingNewClient(false);
    }
  };

  // Fetch customer addresses when opening address dialog
  const fetchCustomerAddresses = async () => {
    if (!selectedCustomer?.cpf || selectedCustomer.cpf === "000.000.000-00") {
      setCustomerAddresses([]);
      return;
    }
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_cpf", selectedCustomer.cpf)
      .order("is_default", { ascending: false });
    setCustomerAddresses(data || []);
  };

  const handleNewAddrCepLookup = async (cep: string) => {
    setNewAddrCep(cep);
    const result = await handleCepLookup(cep);
    if (result) {
      setNewAddrStreet(result.street);
      setNewAddrNeighborhood(result.neighborhood);
      setNewAddrCity(result.city);
      setNewAddrState(result.state);
    }
  };

  const handleSaveNewAddress = async () => {
    if (!newAddrStreet.trim()) { toast.error("Rua é obrigatória"); return; }
    const addr: SelectedAddress = {
      street: newAddrStreet, number: newAddrNumber, complement: newAddrComplement,
      neighborhood: newAddrNeighborhood, city: newAddrCity, state: newAddrState, zip_code: newAddrCep,
    };

    // Save to DB if customer has CPF
    if (selectedCustomer && selectedCustomer.cpf !== "000.000.000-00") {
      await supabase.from("customer_addresses").insert({
        customer_cpf: selectedCustomer.cpf,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        street: addr.street, number: addr.number, complement: addr.complement,
        neighborhood: addr.neighborhood, city: addr.city, state: addr.state, zip_code: addr.zip_code,
      });
    }

    applyAddress(addr);
    setShowAddressDialog(false);
    resetNewAddrForm();
    toast.success("Endereço selecionado!");
  };

  const resetNewAddrForm = () => {
    setShowNewAddressForm(false);
    setNewAddrCep(""); setNewAddrStreet(""); setNewAddrNumber("");
    setNewAddrComplement(""); setNewAddrNeighborhood(""); setNewAddrCity(""); setNewAddrState("");
  };

  const clearForm = () => {
    setCart([]);
    setCustomerName(""); setCustomerPhone(""); setCustomerCpf("");
    setDeliveryAddress(""); setDeliveryCep(""); setDeliveryNeighborhood(""); setDeliveryCity("");
    setNotes(""); setPaymentType(""); setSelectedTableId("");
    setSelectedCustomer(null);
    setSelectedAddress(null);
    setShowNewClientForm(false);
    setDiscountExpanded(false);
    setDiscountType("value");
    setDiscountTarget("total");
    setDiscountValue("");
    setDiscountNotes("");
    setEmployeeCreditName("");
    setEmployeeCreditNotes("");
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
            extra_name: e.name,
          }))
        );
      }
    }
  };

  // CRM: Save/update customer data before creating orders
  const upsertCustomerCRM = async () => {
    const cpf = customerCpf?.replace(/\D/g, "");
    if (!cpf || cpf.length < 11) return;
    const name = customerName || "Cliente PDV";
    const phone = customerPhone || null;

    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("cpf", customerCpf)
      .maybeSingle();

    if (existing) {
      await supabase.from("customers").update({
        name, phone,
      }).eq("id", existing.id);
    } else {
      await supabase.from("customers").insert({
        restaurant_id: restaurantId,
        cpf: customerCpf,
        name,
        phone,
      });
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error("Adicione produtos ao carrinho"); return; }
    if (!customerName && orderType !== "mesa") { toast.error("Nome do cliente é obrigatório"); return; }

    setSubmitting(true);
    try {
      // Save customer to CRM
      await upsertCustomerCRM();
      if (orderType === "delivery") {
        if (!customerPhone) throw new Error("Telefone é obrigatório para delivery");
        const discountForOrder = calculatedDiscount > 0 ? calculatedDiscount : null;
        const discountNotesText = discountNotes ? ` [Desconto: ${discountNotes}]` : "";
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "delivery",
          status: "preparing", customer_name: customerName,
          customer_cpf: customerCpf || "000.000.000-00",
          delivery_phone: customerPhone,
          delivery_address: deliveryAddress ? `${deliveryAddress}, ${deliveryNeighborhood}, ${deliveryCity}` : null,
          notes: (notes || "") + discountNotesText || null, payment_type: paymentType || null,
          coupon_discount: discountForOrder,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);

      } else if (orderType === "retirada") {
        const discountForOrder = calculatedDiscount > 0 ? calculatedDiscount : null;
        const discountNotesText = discountNotes ? ` [Desconto: ${discountNotes}]` : "";
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "delivery", delivery_type: "pickup",
          status: "preparing", customer_name: customerName || "Cliente",
          customer_cpf: customerCpf || "000.000.000-00",
          notes: (notes || "") + discountNotesText || null, payment_type: paymentType || null,
          coupon_discount: discountForOrder,
          pdv_source: true,
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

        const discountForOrder = calculatedDiscount > 0 ? calculatedDiscount : null;
        const discountNotesText = discountNotes ? ` [Desconto: ${discountNotes}]` : "";
        const { data: order, error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId, order_type: "local", table_id: tableId,
          comanda_id: comandaId, status: "pending",
          customer_name: currentCustomerName,
          customer_cpf: currentCustomerCpf,
          notes: (notes || "") + discountNotesText || null, payment_type: paymentType || null,
          coupon_discount: discountForOrder,
          pdv_source: true,
        }).select().single();
        if (error) throw error;
        await insertOrderItems(order.id);
      }

      // Insert employee credit record if payment type is employee_credit
      if (paymentType === "employee_credit") {
        const lastOrder = await supabase.from("orders")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .eq("pdv_source", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastOrder.data) {
          await supabase.from("employee_credits").insert({
            restaurant_id: restaurantId,
            employee_name: employeeCreditName || customerName || "Funcionário",
            order_id: lastOrder.data.id,
            amount: cartTotal,
            status: "pending",
            notes: employeeCreditNotes || null,
            created_by: "Sistema PDV",
          });
        }
      }

      // Deduct stock for PDV orders that start in 'preparing' (trigger misses them)
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

      // Auto-print if enabled
      if (autoPrint) {
        const table = orderType === "mesa" ? tables?.find(t => t.id === selectedTableId) : undefined;
        const printOrderObj = {
          id: "PDV-" + Date.now(),
          created_at: new Date().toISOString(),
          customer_name: customerName || "Cliente PDV",
          order_type: orderType === "mesa" ? "local" : "delivery",
          delivery_type: orderType === "delivery" ? "delivery" : orderType === "retirada" ? "pickup" : undefined,
          tables: table ? { table_number: table.table_number } : null,
          delivery_address: deliveryAddress || undefined,
          delivery_phone: customerPhone || undefined,
          payment_type: paymentType || undefined,
          notes: (notes || "") + (discountNotes ? ` [Desconto: ${discountNotes}]` : ""),
          coupon_discount: calculatedDiscount > 0 ? calculatedDiscount : undefined,
          order_items: cart.map((item, i) => ({
            id: `item-${i}`,
            quantity: item.quantity,
            price_at_order: item.price,
            notes: item.notes || undefined,
            products: { name: item.productName },
            order_item_extras: item.extras.map(e => ({
              price_at_order: e.price,
              product_extras: { name: e.name },
            })),
          })),
        };
        try {
          await printOrder(printOrderObj, restaurantId);
        } catch { /* ignore print errors */ }
      }

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

    const { data: activeComandas } = await supabase.from("comandas")
      .select("id").eq("table_id", table.id).eq("status", "active");
    if (activeComandas && activeComandas.length > 0) {
      for (const comanda of activeComandas) {
        await supabase.from("bills").insert({
          table_id: table.id,
          comanda_id: comanda.id,
          status: "paid",
          paid_at: new Date().toISOString(),
          subtotal: 0,
          service_fee: 0,
          total_amount: 0,
        });
      }
    }

    await supabase.from("comandas").update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("table_id", table.id).eq("status", "active");
    await supabase.from("tables").update({ is_occupied: false, occupied_by: null, occupied_at: null }).eq("id", table.id);
    toast.success(`Mesa ${table.table_number} liberada`);
    refetchTables();
  };

  const handleToggleHidden = async (table: TableData) => {
    const newHidden = !table.is_hidden;
    await supabase.from("tables").update({ is_hidden: newHidden }).eq("id", table.id);
    toast.success(newHidden ? `Mesa ${table.table_number} ocultada` : `Mesa ${table.table_number} visível`);
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
    <div className="h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold">PDV</h2>
          <p className="text-sm text-muted-foreground">
            {tables?.length || 0} mesas • {occupiedTables} ocupadas • {availableTables} livres
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Printer className="h-4 w-4 text-muted-foreground" />
          <label htmlFor="auto-print-toggle" className="text-xs text-muted-foreground cursor-pointer">Auto-print</label>
          <Switch
            id="auto-print-toggle"
            checked={autoPrint}
            onCheckedChange={(checked) => {
              setAutoPrint(checked);
              localStorage.setItem("pdv_auto_print", String(checked));
              toast.success(checked ? "Impressão automática ativada" : "Impressão automática desativada");
            }}
          />
        </div>
      </div>

      {/* Main content: tables grid + order panel */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left: Tables Grid */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Order Search Bar */}
          <div className="flex gap-2 mb-2 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido por nome, CPF ou item..."
                value={orderSearchTerm}
                onChange={e => setOrderSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {orderSearchTerm && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setOrderSearchTerm("")}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Search Results */}
          {(orderSearchTerm.length >= 2) && (
            <div className="mb-2 flex-shrink-0">
              {filteredOrders.length === 0 && orderSearchTerm.length >= 2 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum pedido encontrado</p>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{filteredOrders.length} pedido{filteredOrders.length !== 1 ? "s" : ""} encontrado{filteredOrders.length !== 1 ? "s" : ""}</p>
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                    {filteredOrders.map((order: any) => {
                      const statusMap: Record<string, { label: string; variant: "default" | "warning" | "success" | "secondary" | "destructive" }> = {
                        pending: { label: "Pendente", variant: "warning" },
                        accepted: { label: "Aceito", variant: "default" },
                        preparing: { label: "Preparando", variant: "default" },
                        ready: { label: "Pronto", variant: "success" },
                        delivered: { label: "Entregue", variant: "secondary" },
                        cancelled: { label: "Cancelado", variant: "destructive" },
                        paid: { label: "Pago", variant: "success" },
                      };
                      const status = statusMap[order.status] || { label: order.status, variant: "secondary" as const };
                      const itemsSummary = order.order_items?.map((i: any) => `${i.quantity}x ${i.products?.name || "?"}`).join(", ") || "";
                      const tableInfo = order.tables;
                      const tableLabel = tableInfo ? (tableInfo.table_name || `Mesa ${tableInfo.table_number}`) : "—";
                      const orderTime = order.created_at ? format(new Date(order.created_at), "HH:mm") : "";

                      return (
                        <Card
                          key={order.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            if (order.table_id && tables) {
                              const t = tables.find(tb => tb.id === order.table_id);
                              if (t) { setSelectedTableForDrawer(t); setOrderSearchTerm(""); }
                            }
                          }}
                        >
                          <CardContent className="p-2.5 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {tableInfo?.table_number || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium truncate">{order.customer_name}</span>
                                <Badge variant={status.variant} className="text-[10px] flex-shrink-0">{status.label}</Badge>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">{orderTime}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{tableLabel} • {itemsSummary}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Gerenciar Mesas button */}
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsManageTablesOpen(true)} className="text-xs h-7">
              <Settings className="w-3.5 h-3.5 mr-1" />
              Gerenciar Mesas
            </Button>
          </div>

          {/* Tables Grid (scrollable) */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tables?.map(table => {
                const isOccupied = table.is_occupied;
                const comandaCount = table.comandas?.length || 0;
                const isSelected = selectedTableId === table.id;
                const occupiedSince = table.occupied_at ? format(new Date(table.occupied_at), "HH:mm") : null;
                return (
                  <Card
                    key={table.id}
                    className={`${table.is_hidden ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} transition-all hover:shadow-md relative ${
                      isSelected ? "ring-2 ring-primary border-primary" :
                      table.is_hidden ? "border-border bg-muted/30" :
                      isOccupied ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-green-300 bg-green-50 dark:bg-green-950/20"
                    }`}
                    onClick={() => !table.is_hidden && handleTableClick(table)}
                    onDoubleClick={() => !table.is_hidden && handleTableSelect(table)}
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
                        <DropdownMenuItem onClick={() => handleToggleHidden(table)}>
                          {table.is_hidden ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                          {table.is_hidden ? "Tornar Visível" : "Ocultar Mesa"}
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
                        table.is_hidden ? "bg-muted-foreground/40" :
                        isOccupied ? "bg-red-500" : "bg-green-400"
                      }`}>
                        {table.table_number}
                      </div>
                      <p className="text-xs font-medium">{table.table_name || `Mesa ${table.table_number}`}</p>
                      {(pendingByTable.get(table.id) || 0) > 0 && (
                        <Badge variant="destructive" className="text-[10px] animate-pulse">
                          🔔 Pedido Novo
                        </Badge>
                      )}
                      {!isOccupied && reservationByTable.has(table.id) && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                          🕐 Reservado {reservationByTable.get(table.id)!.time}
                        </Badge>
                      )}
                      <Badge variant={table.is_hidden ? "outline" : isOccupied ? "default" : "secondary"} className="text-[10px]">
                        {table.is_hidden ? "Oculta" : isOccupied ? `${comandaCount} comanda${comandaCount !== 1 ? "s" : ""}` : "Livre"}
                      </Badge>
                      {isOccupied && occupiedSince && showPrepTimer && (
                        <p className="text-[10px] text-muted-foreground">Desde {occupiedSince}</p>
                      )}
                      {isOccupied && table.comandas && table.comandas.length > 0 && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {table.comandas.map(c => c.customer_name).join(", ")}
                        </div>
                      )}
                      {(() => {
                        const active = activeByTable.get(table.id);
                        if (!active || active.itemCount === 0) return null;
                        return (
                          <p className="text-[10px] text-muted-foreground">
                            📋 {active.itemCount} ite{active.itemCount !== 1 ? "ns" : "m"}
                          </p>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Order Creation Panel (always visible) */}
        <div className="w-[520px] flex-shrink-0 border-l pl-6 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Novo Pedido</h3>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearForm} className="text-xs text-muted-foreground">
                Limpar
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-5 pr-3">
              {/* Order type tabs */}
              <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="mesa" className="text-xs">Mesa</TabsTrigger>
                  <TabsTrigger value="delivery" className="text-xs">Delivery</TabsTrigger>
                  <TabsTrigger value="retirada" className="text-xs">Retirada</TabsTrigger>
                  <TabsTrigger value="viagem" className="text-xs">Viagem</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Customer Section — Compact */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground mb-3">Cliente</p>

                {!selectedCustomer && (
                  <>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsCustomerSelectOpen(true)}>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar Cliente
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowNewClientForm(!showNewClientForm)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Criar Novo
                      </Button>
                    </div>

                    <Collapsible open={showNewClientForm} onOpenChange={setShowNewClientForm}>
                      <CollapsibleContent className="mt-3 space-y-3">
                        <div>
                          <Label className="text-xs mb-1.5 block">CPF (opcional)</Label>
                          <Input placeholder="000.000.000-00" value={newClientCpf} onChange={e => setNewClientCpf(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Nome</Label>
                          <Input placeholder="Nome do cliente" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Celular</Label>
                          <Input placeholder="(00) 00000-0000" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <Button size="sm" onClick={handleSaveNewClient} disabled={savingNewClient} className="w-full">
                          {savingNewClient ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Salvar Cliente
                        </Button>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}

                {selectedCustomer && (
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{selectedCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCustomer.phone || "Sem telefone"}
                        {selectedCustomer.cpf && selectedCustomer.cpf !== "000.000.000-00" && ` • ${selectedCustomer.cpf}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearCustomer} className="h-8 w-8 p-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Delivery Address Section */}
              {orderType === "delivery" && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Endereço de Entrega</p>

                  {!selectedCustomer && (
                    <p className="text-sm text-muted-foreground italic">
                      Selecione um cliente para ver os endereços salvos
                    </p>
                  )}

                  {selectedCustomer && !selectedAddress && (
                    <div className="border border-dashed rounded-lg p-3 text-center text-sm text-muted-foreground">
                      Endereço do cliente buscado aparecerá aqui
                    </div>
                  )}

                  {selectedAddress && (
                    <div className="p-3 bg-background rounded-lg border text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{selectedAddress.street}{selectedAddress.number ? `, ${selectedAddress.number}` : ""}</p>
                          <p className="text-muted-foreground">{selectedAddress.neighborhood} — {selectedAddress.city}{selectedAddress.state ? ` - ${selectedAddress.state}` : ""}</p>
                          {selectedAddress.complement && <p className="text-muted-foreground text-xs">{selectedAddress.complement}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCustomer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => { fetchCustomerAddresses(); setShowAddressDialog(true); }}
                    >
                      {selectedAddress ? "Alterar endereço" : "Selecionar endereço"}
                    </Button>
                  )}
                </div>
              )}

              {/* Mesa selector */}
              {orderType === "mesa" && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold mb-1.5 block">Mesa</Label>
                  <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione uma mesa" /></SelectTrigger>
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold mb-1.5 block">Observações</Label>
                <Textarea placeholder="Observações..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[50px] text-sm" />
              </div>

              {/* Payment */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold mb-1.5 block">Pagamento</Label>
                <Select value={paymentType} onValueChange={(v) => setPaymentType(v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Método de pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="meal_voucher">Vale Refeição</SelectItem>
                    <SelectItem value="employee_credit">Crédito de Funcionário</SelectItem>
                  </SelectContent>
                </Select>
                {(paymentType === "credit" || paymentType === "debit" || paymentType.startsWith("Crédito") || paymentType.startsWith("Débito")) && (
                  <Select
                    value={paymentType.includes(" - ") ? paymentType : ""}
                    onValueChange={(v) => setPaymentType(v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione a bandeira do cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {(paymentType === "credit" || paymentType.startsWith("Crédito")) ? (
                        <>
                          <SelectItem value="Crédito - Visa">Crédito - Visa</SelectItem>
                          <SelectItem value="Crédito - Mastercard">Crédito - Mastercard</SelectItem>
                          <SelectItem value="Crédito - Elo">Crédito - Elo</SelectItem>
                          <SelectItem value="Crédito - Amex">Crédito - Amex</SelectItem>
                          <SelectItem value="Crédito - Hipercard">Crédito - Hipercard</SelectItem>
                          <SelectItem value="Crédito - Diners">Crédito - Diners</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Débito - Visa">Débito - Visa</SelectItem>
                          <SelectItem value="Débito - Mastercard">Débito - Mastercard</SelectItem>
                          <SelectItem value="Débito - Elo">Débito - Elo</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}

                {/* Employee Credit Fields */}
                {paymentType === "employee_credit" && (
                  <div className="space-y-2 border rounded-lg p-3 bg-amber-50/50">
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Este pedido será lançado como crédito pendente.
                    </div>
                    <div>
                      <Label className="text-xs">Nome do Funcionário *</Label>
                      <Input
                        placeholder="Nome do funcionário"
                        value={employeeCreditName}
                        onChange={e => setEmployeeCreditName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Observação</Label>
                      <Input
                        placeholder="Observação (opcional)"
                        value={employeeCreditNotes}
                        onChange={e => setEmployeeCreditNotes(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Discount Section */}
              {cart.length > 0 && (
                <Collapsible open={discountExpanded} onOpenChange={setDiscountExpanded}>
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Desconto</p>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDiscountExpanded(!discountExpanded)}>
                        {discountExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>

                    <CollapsibleContent className="mt-3 space-y-3">
                      {/* Type toggle */}
                      <div className="flex gap-2">
                        <Button
                          variant={discountType === "percentage" ? "default" : "outline"}
                          size="sm" className="flex-1"
                          onClick={() => setDiscountType("percentage")}
                        >
                          %
                        </Button>
                        <Button
                          variant={discountType === "value" ? "default" : "outline"}
                          size="sm" className="flex-1"
                          onClick={() => setDiscountType("value")}
                        >
                          R$
                        </Button>
                      </div>

                      {/* Target selector */}
                      <Select value={discountTarget} onValueChange={setDiscountTarget}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Aplicar no total do pedido" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="total">Total do pedido</SelectItem>
                          {cart.map(item => (
                            <SelectItem key={item.productId} value={item.productId}>
                              {item.productName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Value input */}
                      <Input
                        type="number"
                        min={0}
                        max={discountType === "percentage" ? 100 : undefined}
                        placeholder={discountType === "percentage" ? "Ex: 10" : "Ex: 15.00"}
                        value={discountValue}
                        onChange={e => setDiscountValue(e.target.value)}
                        className="h-9 text-sm"
                      />

                      {/* Notes */}
                      <Input
                        placeholder="Motivo do desconto (opcional)"
                        value={discountNotes}
                        onChange={e => setDiscountNotes(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </CollapsibleContent>

                    {/* Preview */}
                    {calculatedDiscount > 0 && (
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-muted-foreground">Desconto aplicado</span>
                        <span className="text-green-600 font-medium">- R$ {calculatedDiscount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </Collapsible>
              )}


              <div className="space-y-3">
                <Label className="text-xs font-semibold mb-1.5 block">Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto">
                  {filteredProducts.map(product => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={async () => {
                        const { data: complementGroups } = await supabase
                          .from("product_complement_groups")
                          .select("extra_category_id, is_required, min_selection, max_selection, extra_categories(id, name, extra_category_items(id, name, price))")
                          .eq("product_id", product.id)
                          .order("display_order");

                        const complementExtras = (complementGroups || []).flatMap((g: any) => {
                          const cat = g.extra_categories;
                          if (!cat?.extra_category_items) return [];
                          return cat.extra_category_items.map((item: any) => ({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            is_required: g.is_required,
                            min_selection: g.min_selection,
                            max_selection: g.max_selection,
                            is_complement: true,
                          }));
                        });

                        const combinedExtras = [
                          ...(product.product_extras || []),
                          ...complementExtras,
                        ];

                        setSelectedProduct({ ...product, product_extras: combinedExtras });
                        setIsProductDrawerOpen(true);
                      }}
                    >
                      <CardContent className="p-2 space-y-0.5">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-14 object-cover rounded" />
                        ) : (
                          <div className="w-full h-14 bg-muted rounded flex items-center justify-center text-sm font-bold text-muted-foreground">
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

              {/* Cart Summary */}
              {cart.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Carrinho ({cart.length})
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
                  <div className="pt-2 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Subtotal</span>
                      <span>R$ {cartSubtotal.toFixed(2)}</span>
                    </div>
                    {calculatedDiscount > 0 && (
                      <div className="flex items-center justify-between text-sm text-green-600">
                        <span>Desconto</span>
                        <span>- R$ {calculatedDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span>Total</span>
                      <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t pt-3 mt-2 flex items-center justify-between">
            <div className="text-xs">
              <ShoppingCart className="w-3.5 h-3.5 inline mr-1" />
              {cart.length} ite{cart.length !== 1 ? "ns" : "m"} • <span className="font-bold">R$ {cartTotal.toFixed(2)}</span>
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

      {/* Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Endereço</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {customerAddresses.length > 0 && (
              <div className="space-y-2">
                {customerAddresses.map((addr: any) => (
                  <div
                    key={addr.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      applyAddress({
                        street: addr.street, number: addr.number, complement: addr.complement || "",
                        neighborhood: addr.neighborhood, city: addr.city, state: addr.state, zip_code: addr.zip_code,
                      });
                      setShowAddressDialog(false);
                      toast.success("Endereço selecionado!");
                    }}
                  >
                    <p className="text-sm font-medium">{addr.street}, {addr.number}</p>
                    <p className="text-xs text-muted-foreground">{addr.neighborhood} — {addr.city} - {addr.state}</p>
                    {addr.is_default && <Badge variant="secondary" className="text-[10px] mt-1">Padrão</Badge>}
                  </div>
                ))}
              </div>
            )}

            {customerAddresses.length === 0 && !showNewAddressForm && (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum endereço salvo</p>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowNewAddressForm(!showNewAddressForm)}>
              <Plus className="w-4 h-4 mr-2" /> Novo endereço
            </Button>

            {showNewAddressForm && (
              <div className="space-y-3 border-t pt-3">
                <div>
                  <Label className="text-xs mb-1.5 block">CEP</Label>
                  <Input placeholder="00000-000" value={newAddrCep} onChange={e => handleNewAddrCepLookup(e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Rua</Label>
                  <Input placeholder="Rua" value={newAddrStreet} onChange={e => setNewAddrStreet(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs mb-1.5 block">Número</Label>
                    <Input placeholder="Nº" value={newAddrNumber} onChange={e => setNewAddrNumber(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Complemento</Label>
                    <Input placeholder="Apto, Bloco..." value={newAddrComplement} onChange={e => setNewAddrComplement(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Bairro</Label>
                  <Input placeholder="Bairro" value={newAddrNeighborhood} onChange={e => setNewAddrNeighborhood(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs mb-1.5 block">Cidade</Label>
                    <Input placeholder="Cidade" value={newAddrCity} onChange={e => setNewAddrCity(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Estado</Label>
                    <Input placeholder="UF" value={newAddrState} onChange={e => setNewAddrState(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveNewAddress} className="w-full">
                  Confirmar Endereço
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
