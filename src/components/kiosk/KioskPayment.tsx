import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Banknote, CreditCard, QrCode, Loader2, ChevronLeft, Zap, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { CartItem } from "@/types/menu";
import { KioskCustomer } from "@/pages/Kiosk";
import { KioskConfig, KioskPointTerminal } from "@/hooks/useKioskConfig";
import { ConsumptionMode } from "./KioskConsumptionType";

type PointPaymentStatus = "idle" | "creating_payment" | "waiting_terminal" | "processing" | "paid" | "failed" | "canceled";
type CardStep = "method" | "card_type" | "card_brand";

interface Props {
  cart: CartItem[];
  restaurant: any;
  customer: KioskCustomer;
  consumptionMode: ConsumptionMode;
  tableNumber: string;
  primaryColor: string;
  cartTotal: number;
  onBack: () => void;
  onOrderCreated: (orderId: string) => void;
  kioskConfig?: KioskConfig | null;
  pointTerminal?: KioskPointTerminal | null;
  appliedCoupon?: any;
  couponDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyRealPerPoint?: number;
  deliveryAddress?: string;
}

const CARD_TYPES = [
  { key: "credit_card", label: "Crédito", icon: CreditCard },
  { key: "debit_card", label: "Débito", icon: CreditCard },
  { key: "voucher", label: "Vale Refeição", icon: CreditCard },
];

const CARD_BRANDS = [
  { code: "visa", name: "Visa" },
  { code: "mastercard", name: "Mastercard" },
  { code: "elo", name: "Elo" },
  { code: "hipercard", name: "Hipercard" },
  { code: "amex", name: "American Express" },
  { code: "diners", name: "Diners Club" },
  { code: "outros", name: "Outros" },
];

export function KioskPayment({
  cart, restaurant, customer, consumptionMode, tableNumber, primaryColor, cartTotal, onBack, onOrderCreated, kioskConfig,
  pointTerminal, appliedCoupon, couponDiscount = 0, loyaltyPointsUsed = 0, loyaltyRealPerPoint = 0.01, deliveryAddress,
}: Props) {
  // "cash" | "point_card" | "point_pix"
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [cardStep, setCardStep] = useState<CardStep>("method");
  const [selectedCardType, setSelectedCardType] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [cashPaid, setCashPaid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Point terminal payment state
  const [pointStatus, setPointStatus] = useState<PointPaymentStatus>("idle");
  const [mpOrderId, setMpOrderId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createdOrderIdRef = useRef<string | null>(null);
  const orderCreationInProgressRef = useRef(false);

  const pointsDiscount = loyaltyPointsUsed * loyaltyRealPerPoint;
  const finalTotal = Math.max(0, cartTotal - couponDiscount - pointsDiscount);

  const changeAmount = paymentMethod === "cash" && cashPaid
    ? Math.max(0, parseFloat(cashPaid) - finalTotal)
    : 0;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getOrderTypeFields = () => {
    switch (consumptionMode) {
      case "counter": return { order_type: "balcao", delivery_type: "pickup" };
      case "table": return { order_type: "local", delivery_type: "local" };
      case "takeaway": return { order_type: "delivery", delivery_type: "takeaway" };
      case "delivery": return { order_type: "delivery", delivery_type: "delivery" };
      default: return { order_type: "local", delivery_type: "local" };
    }
  };

  const getConsumptionLabel = () => {
    switch (consumptionMode) {
      case "counter": return "Retirada no balcão";
      case "table": return `Mesa ${tableNumber}`;
      case "takeaway": return "Para viagem";
      case "delivery": return "Entrega";
      default: return "";
    }
  };

  const getPaymentTypeForDB = () => {
    if (paymentMethod === "cash") return "cash";
    if (paymentMethod === "point_pix") return "pix";
    if (paymentMethod === "point_card") {
      if (selectedCardType === "credit_card") return "credit";
      if (selectedCardType === "debit_card") return "debit";
      if (selectedCardType === "voucher") return "voucher";
      return "card";
    }
    return paymentMethod;
  };

  const getMpPaymentType = () => {
    if (paymentMethod === "point_pix") return "bank_transfer";
    if (paymentMethod === "point_card") {
      if (selectedCardType === "debit_card") return "debit_card";
      if (selectedCardType === "voucher") return "voucher_card";
      return "credit_card";
    }
    return "credit_card";
  };

  const createOrderInDB = useCallback(async (): Promise<string | null> => {
    const { order_type, delivery_type } = getOrderTypeFields();

    let tableId: string | null = null;
    if (consumptionMode === "table" && tableNumber) {
      const { data: table } = await supabase
        .from("tables")
        .select("id")
        .eq("restaurant_id", restaurant.id)
        .eq("table_number", parseInt(tableNumber))
        .maybeSingle();
      tableId = table?.id || null;
      if (!tableId) {
        toast.error(`Mesa ${tableNumber} não encontrada`);
        return null;
      }
    }

    const paymentLabel = paymentMethod === "point_card"
      ? `[Maquininha - ${selectedCardType === "credit_card" ? "Crédito" : selectedCardType === "debit_card" ? "Débito" : "Vale"}${selectedBrand ? ` ${selectedBrand}` : ""}]`
      : paymentMethod === "point_pix"
        ? "[Maquininha - PIX]"
        : "";

    const notes = [
      `[TOTEM] ${getConsumptionLabel()}`,
      paymentMethod === "cash" && cashPaid ? `Troco para: R$ ${parseFloat(cashPaid).toFixed(2)}` : null,
      paymentLabel || null,
    ].filter(Boolean).join(" | ");

    const orderData: any = {
      table_id: tableId,
      restaurant_id: restaurant.id,
      customer_name: customer.name,
      customer_cpf: customer.cpf,
      order_type,
      delivery_type,
      order_channel: "totem",
      payment_type: getPaymentTypeForDB(),
      payment_brand: selectedBrand || null,
      status: "pending",
      payment_status: "pending",
      notes,
      delivery_phone: customer.phone || null,
      coupon_code: appliedCoupon?.code || null,
      coupon_discount: couponDiscount,
      loyalty_points_used: loyaltyPointsUsed,
      reward_discount: pointsDiscount,
    };

    if (consumptionMode === "delivery" && deliveryAddress) {
      orderData.delivery_address = deliveryAddress;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    for (const item of cart) {
      const priceAtOrder = item.product.promotional_price ?? item.product.price;
      const { data: orderItem, error: itemError } = await supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price_at_order: priceAtOrder,
          notes: item.notes,
        })
        .select()
        .single();
      if (itemError) throw itemError;

      for (const extra of item.extras) {
        await supabase.from("order_item_extras").insert({
          order_item_id: orderItem.id,
          product_extra_id: extra.id,
          price_at_order: extra.price,
          extra_name: extra.name,
        });
      }
    }

    // Create comanda for table orders
    if (consumptionMode === "table" && tableId) {
      const { data: comanda, error: comandaError } = await supabase
        .from("comandas")
        .insert({
          restaurant_id: restaurant.id,
          table_id: tableId,
          customer_name: customer.name,
          customer_cpf: customer.cpf || "000.000.000-00",
          status: "active",
        })
        .select()
        .single();

      if (!comandaError && comanda) {
        await supabase.from("orders").update({ comanda_id: comanda.id }).eq("id", order.id);
      }
    }

    // Update coupon usage
    if (appliedCoupon?.id) {
      await supabase.from("coupons").update({
        used_count: (appliedCoupon.used_count || 0) + 1,
      }).eq("id", appliedCoupon.id);
    }

    // Update loyalty
    if (restaurant.loyalty_enabled && customer.cpf) {
      const pointsToEarn = Math.floor(finalTotal * (restaurant.loyalty_points_per_real || 1));
      if (pointsToEarn > 0) {
        const { data: existing } = await supabase
          .from("loyalty_points")
          .select("*")
          .eq("customer_cpf", customer.cpf)
          .eq("restaurant_id", restaurant.id)
          .maybeSingle();

        if (existing) {
          await supabase.from("loyalty_points").update({
            points_balance: existing.points_balance + pointsToEarn - loyaltyPointsUsed,
            total_earned: existing.total_earned + pointsToEarn,
            total_redeemed: (existing.total_redeemed || 0) + loyaltyPointsUsed,
            last_updated: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("loyalty_points").insert({
            customer_cpf: customer.cpf,
            restaurant_id: restaurant.id,
            points_balance: pointsToEarn - loyaltyPointsUsed,
            total_earned: pointsToEarn,
            total_redeemed: loyaltyPointsUsed,
          });
        }

        if (pointsToEarn > 0) {
          await supabase.from("loyalty_transactions").insert({
            customer_cpf: customer.cpf, restaurant_id: restaurant.id, order_id: order.id, points: pointsToEarn, type: "earn",
          });
        }
        if (loyaltyPointsUsed > 0) {
          await supabase.from("loyalty_transactions").insert({
            customer_cpf: customer.cpf, restaurant_id: restaurant.id, order_id: order.id, points: -loyaltyPointsUsed, type: "redeem",
          });
        }
      }
    }

    return order.id;
  }, [restaurant, customer, cart, consumptionMode, tableNumber, paymentMethod, selectedCardType, selectedBrand, cashPaid, finalTotal, appliedCoupon, couponDiscount, loyaltyPointsUsed, pointsDiscount, deliveryAddress]);

  const startPointPolling = useCallback((mpOrdId: string) => {
    setPointStatus("waiting_terminal");

    // Timeout after 120s
    timeoutRef.current = setTimeout(async () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setPointStatus("canceled");

      try {
        await supabase.functions.invoke("mercadopago-point", {
          body: { action: "cancel_order", restaurant_id: restaurant.id, mp_order_id: mpOrdId },
        });
      } catch (e) {
        console.error("[KioskPayment] Cancel error:", e);
      }

      toast.error("Tempo esgotado. Tente novamente.");
    }, 120_000);

    // Poll every 3s
    pollingRef.current = setInterval(async () => {
      try {
        const { data: res } = await supabase.functions.invoke("mercadopago-point", {
          body: { action: "get_order", restaurant_id: restaurant.id, mp_order_id: mpOrdId },
        });

        if (!res?.ok) return;

        const status = res.data?.status;
        const data = res.data;
        const txn = data?.transactions?.payments?.[0];

        if (status === "processed" || status === "finished") {
          if (txn?.status_detail === "accredited" || txn?.status === "approved") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setPointStatus("paid");

            // Guard against duplicate order creation from overlapping polling ticks
            if (orderCreationInProgressRef.current) return;
            orderCreationInProgressRef.current = true;

            // Payment confirmed — NOW create the order in DB
            try {
              const orderId = await createOrderInDB();
              if (orderId) {
                // Order already created with correct payment info, just update paid_at
                await supabase.from("orders").update({
                  payment_status: "paid",
                  paid_at: new Date().toISOString(),
                }).eq("id", orderId);
                createdOrderIdRef.current = orderId;
                onOrderCreated(orderId);
              } else {
                toast.error("Pagamento confirmado, mas erro ao criar pedido.");
              }
            } catch (dbErr: any) {
              console.error("[KioskPayment] DB error after payment:", dbErr);
              toast.error("Pagamento confirmado, mas erro ao salvar pedido.");
            }
          } else {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setPointStatus("failed");
            toast.error("Pagamento recusado na maquininha.");
          }
        } else if (status === "canceled" || status === "expired") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setPointStatus("canceled");
          toast.error("Pagamento cancelado.");
        } else if (status === "processing") {
          setPointStatus("processing");
        }
      } catch (e) {
        console.error("[KioskPayment] Polling error:", e);
      }
    }, 3000);
  }, [restaurant.id, onOrderCreated, createOrderInDB]);

  const handlePointPayment = async () => {
    if (!pointTerminal) {
      toast.error("Nenhuma maquininha configurada");
      return;
    }
    setSubmitting(true);
    setPointStatus("creating_payment");

    try {
      // Generate a temporary idempotency key — order will only be created after payment confirmation
      const tempId = crypto.randomUUID();

      const { data: res } = await supabase.functions.invoke("mercadopago-point", {
        body: {
          action: "create_order",
          restaurant_id: restaurant.id,
          amount: finalTotal,
          description: `Pedido Totem`,
          order_id: tempId,
          device_id: pointTerminal.device_id,
          idempotency_key: tempId,
          payment_type: getMpPaymentType(),
        },
      });

      if (!res?.ok || !res.data?.id) {
        const errMsg = res?.error || "Erro ao enviar para maquininha";
        if (res?.code === "TOKEN_EXPIRED") {
          toast.error("Token expirado. Reconecte a conta Mercado Pago.");
        } else {
          toast.error(errMsg);
        }
        setPointStatus("failed");
        setSubmitting(false);
        return;
      }

      setMpOrderId(res.data.id);
      startPointPolling(res.data.id);
    } catch (err: any) {
      console.error("[KioskPayment] Point payment error:", err);
      toast.error(err?.message || "Erro ao processar pagamento");
      setPointStatus("failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPointPayment = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (mpOrderId) {
      try {
        await supabase.functions.invoke("mercadopago-point", {
          body: { action: "cancel_order", restaurant_id: restaurant.id, mp_order_id: mpOrderId },
        });
      } catch (e) {
        console.error("[KioskPayment] Cancel error:", e);
      }
    }

    setPointStatus("idle");
    setMpOrderId(null);
  };

  const handleRetryPointPayment = () => {
    setPointStatus("idle");
    setMpOrderId(null);
    handlePointPayment();
  };

  const handleFinalize = async () => {
    if (submitting) return;

    if (paymentMethod === "point_card" || paymentMethod === "point_pix") {
      handlePointPayment();
      return;
    }

    setSubmitting(true);
    try {
      const orderId = await createOrderInDB();
      if (!orderId) {
        setSubmitting(false);
        return;
      }
      onOrderCreated(orderId);
    } catch (err: any) {
      console.error("[Kiosk] Order error:", err);
      toast.error(err?.message || "Erro ao finalizar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  // Build available payment methods
  const hasTerminal = !!pointTerminal;
  const methods: { key: string; label: string; icon: any; sublabel?: string }[] = [];

  if (kioskConfig?.payment_cash !== false) {
    methods.push({ key: "cash", label: "Dinheiro", icon: Banknote, sublabel: "Pagar no balcão" });
  }
  if (kioskConfig?.payment_card !== false && hasTerminal) {
    methods.push({ key: "point_card", label: "Cartão na Maquininha", icon: CreditCard, sublabel: "Crédito, Débito ou Vale" });
  }
  if (kioskConfig?.payment_pix !== false && hasTerminal) {
    methods.push({ key: "point_pix", label: "Pix na Maquininha", icon: QrCode, sublabel: "QR Code PIX no terminal" });
  }

  const handleMethodSelect = (key: string) => {
    setPaymentMethod(key);
    setSelectedCardType("");
    setSelectedBrand("");
    setPointStatus("idle");
    if (key === "point_card") {
      setCardStep("card_type");
    } else {
      setCardStep("method");
    }
  };

  const handleCardTypeSelect = (type: string) => {
    setSelectedCardType(type);
    setCardStep("card_brand");
  };

  const handleBrandSelect = (brand: string) => {
    setSelectedBrand(brand);
    setCardStep("method");
  };

  const isPointPayment = paymentMethod === "point_card" || paymentMethod === "point_pix";

  const canFinalizePayment =
    paymentMethod !== "" &&
    (paymentMethod !== "point_card" || (selectedCardType !== "" && selectedBrand !== "")) &&
    (paymentMethod !== "cash" || !cashPaid || parseFloat(cashPaid) >= finalTotal) &&
    (!isPointPayment || pointStatus === "idle" || pointStatus === "failed" || pointStatus === "canceled");

  // Render Point payment waiting screen
  if (isPointPayment && pointStatus !== "idle" && pointStatus !== "failed" && pointStatus !== "canceled") {
    const statusMessages: Record<string, string> = {
      creating_payment: "Enviando para a maquininha...",
      waiting_terminal: paymentMethod === "point_pix" ? "Aguardando pagamento PIX na maquininha..." : "Aguardando pagamento na maquininha...",
      processing: "Processando pagamento...",
      paid: "Pagamento aprovado!",
    };

    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <div className="text-center space-y-6 p-8 max-w-md">
          {pointStatus === "paid" ? (
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto">
              <Zap className="h-10 w-10 text-green-600" />
            </div>
          ) : (
            <Loader2 className="h-16 w-16 animate-spin mx-auto" style={{ color: primaryColor }} />
          )}
          <p className="text-2xl font-bold text-foreground">{statusMessages[pointStatus]}</p>
          <p className="text-4xl font-bold" style={{ color: primaryColor }}>R$ {finalTotal.toFixed(2)}</p>
          {pointStatus !== "paid" && (
            <Button
              variant="outline"
              onClick={handleCancelPointPayment}
              className="gap-2 mt-4"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-4 p-5 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-12 w-12 rounded-full">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-xl font-bold text-foreground">Pagamento</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-lg mx-auto w-full">
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground">Total do pedido</p>
          <p className="text-4xl font-bold mt-1" style={{ color: primaryColor }}>R$ {finalTotal.toFixed(2)}</p>
          {(couponDiscount > 0 || pointsDiscount > 0) && (
            <p className="text-sm text-green-600 mt-1">
              Economia: R$ {(couponDiscount + pointsDiscount).toFixed(2)}
            </p>
          )}
        </div>

        {/* Failed/Canceled point payment - show retry */}
        {(pointStatus === "failed" || pointStatus === "canceled") && isPointPayment && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">
              {pointStatus === "failed" ? "Pagamento recusado" : "Pagamento cancelado"}
            </p>
            <Button onClick={handleRetryPointPayment} variant="outline" size="sm" className="gap-2">
              <Zap className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        )}

        {/* Card type selection sub-screen */}
        {cardStep === "card_type" && paymentMethod === "point_card" ? (
          <div className="space-y-4 mb-8">
            <button onClick={() => { setCardStep("method"); setPaymentMethod(""); }} className="flex items-center gap-2 text-muted-foreground">
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
            <p className="text-lg font-bold text-foreground">Qual tipo de cartão?</p>
            <div className="space-y-3">
              {CARD_TYPES.map(ct => (
                <button
                  key={ct.key}
                  onClick={() => handleCardTypeSelect(ct.key)}
                  className="w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all border-muted hover:border-muted-foreground/30"
                >
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <ct.icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-lg font-bold text-foreground">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : cardStep === "card_brand" && paymentMethod === "point_card" ? (
          <div className="space-y-4 mb-8">
            <button onClick={() => setCardStep("card_type")} className="flex items-center gap-2 text-muted-foreground">
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
            <p className="text-lg font-bold text-foreground">
              Selecione a bandeira — {selectedCardType === "credit_card" ? "Crédito" : selectedCardType === "debit_card" ? "Débito" : "Vale Refeição"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CARD_BRANDS.map(brand => (
                <button
                  key={brand.code}
                  onClick={() => handleBrandSelect(brand.code)}
                  className="p-4 rounded-2xl border-2 flex items-center gap-3 transition-all border-muted hover:border-muted-foreground/30"
                >
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{brand.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Main payment method selection */
          <div className="space-y-3 mb-8">
            {methods.map(m => (
              <button
                key={m.key}
                onClick={() => handleMethodSelect(m.key)}
                className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                  paymentMethod === m.key ? "shadow-lg" : "border-muted hover:border-muted-foreground/30"
                }`}
                style={paymentMethod === m.key ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: paymentMethod === m.key ? primaryColor : undefined }}>
                  <m.icon className="h-6 w-6" style={{ color: paymentMethod === m.key ? "#fff" : undefined }} />
                </div>
                <div className="text-left flex-1">
                  <span className="text-lg font-bold text-foreground">{m.label}</span>
                  {m.key === "point_card" && selectedCardType && selectedBrand && paymentMethod === "point_card" ? (
                    <p className="text-sm font-medium" style={{ color: primaryColor }}>
                      {CARD_TYPES.find(t => t.key === selectedCardType)?.label} — {CARD_BRANDS.find(b => b.code === selectedBrand)?.name}
                    </p>
                  ) : m.sublabel ? (
                    <p className="text-sm text-muted-foreground">{m.sublabel}</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}

        {paymentMethod === "cash" && cardStep === "method" && (
          <div className="space-y-3">
            <Label className="text-lg">Troco para quanto?</Label>
            <Input
              value={cashPaid}
              onChange={(e) => setCashPaid(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
              placeholder="0,00"
              className="text-2xl h-16 text-center rounded-xl"
              inputMode="decimal"
            />
            {cashPaid && parseFloat(cashPaid) >= finalTotal && (
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="text-3xl font-bold text-green-600">R$ {changeAmount.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t bg-card p-5 shrink-0">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleFinalize}
            className="w-full h-14 text-lg font-bold rounded-xl text-white"
            style={{ backgroundColor: primaryColor }}
            disabled={submitting || !canFinalizePayment || cardStep !== "method"}
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" />Finalizando...</>
            ) : isPointPayment ? (
              <><Zap className="h-5 w-5 mr-2" />Enviar para Maquininha</>
            ) : (
              "Finalizar Pedido"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
