import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Banknote, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { CartItem } from "@/types/menu";
import { KioskCustomer } from "@/pages/Kiosk";
import { KioskConfig } from "@/hooks/useKioskConfig";
import { ConsumptionMode } from "./KioskConsumptionType";

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
  appliedCoupon?: any;
  couponDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyRealPerPoint?: number;
}

export function KioskPayment({
  cart, restaurant, customer, consumptionMode, tableNumber, primaryColor, cartTotal, onBack, onOrderCreated, kioskConfig,
  appliedCoupon, couponDiscount = 0, loyaltyPointsUsed = 0, loyaltyRealPerPoint = 0.01,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao" | "pix">("dinheiro");
  const [cashPaid, setCashPaid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pointsDiscount = loyaltyPointsUsed * loyaltyRealPerPoint;
  const finalTotal = Math.max(0, cartTotal - couponDiscount - pointsDiscount);

  const changeAmount = paymentMethod === "dinheiro" && cashPaid
    ? Math.max(0, parseFloat(cashPaid) - finalTotal)
    : 0;

  const canFinalize = paymentMethod !== "dinheiro" || !cashPaid || parseFloat(cashPaid) >= finalTotal;

  /**
   * Order type mapping rules:
   * - counter (balcão): order_type='delivery', delivery_type='pickup' → goes to Pedidos tab
   * - takeaway (viagem): order_type='delivery', delivery_type='takeaway' → goes to Pedidos tab
   * - delivery (entrega): order_type='delivery', delivery_type='delivery' → goes to Pedidos tab
   * - table (mesa): order_type='local', delivery_type='local' → goes to PDV/mesa flow
   * 
   * All totem orders are tagged with order_channel='totem'
   */
  const getOrderTypeFields = () => {
    switch (consumptionMode) {
      case "counter":
        return { order_type: "delivery", delivery_type: "pickup" };
      case "takeaway":
        return { order_type: "delivery", delivery_type: "takeaway" };
      case "delivery":
        return { order_type: "delivery", delivery_type: "delivery" };
      case "table":
        return { order_type: "local", delivery_type: "local" };
      default:
        return { order_type: "delivery", delivery_type: "pickup" };
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

  const handleFinalize = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const { order_type, delivery_type } = getOrderTypeFields();

      // Find table if applicable
      let tableId: string | null = null;
      if (consumptionMode === "table" && tableNumber) {
        const { data: table } = await supabase
          .from("tables")
          .select("id, is_occupied")
          .eq("restaurant_id", restaurant.id)
          .eq("table_number", parseInt(tableNumber))
          .maybeSingle();
        tableId = table?.id || null;

        // Occupy the table if free
        if (table && !table.is_occupied) {
          console.log("[Kiosk] Occupying table:", tableNumber);
          await supabase.from("tables").update({
            is_occupied: true,
            occupied_at: new Date().toISOString(),
            occupied_by: customer.name,
          }).eq("id", table.id);
        }
      }

      const notes = [
        `[TOTEM] ${getConsumptionLabel()}`,
        paymentMethod === "dinheiro" && cashPaid ? `Troco para: R$ ${parseFloat(cashPaid).toFixed(2)}` : null,
      ].filter(Boolean).join(" | ");

      console.log("[Kiosk] Creating order:", {
        order_type, delivery_type, order_channel: "totem",
        consumptionMode, tableId, tableNumber,
        finalTotal, couponDiscount, pointsDiscount,
        destination: consumptionMode === "table" ? "PDV/Mesa" : "Pedidos",
      });

      const orderData = {
        table_id: tableId,
        restaurant_id: restaurant.id,
        customer_name: customer.name,
        customer_cpf: customer.cpf,
        order_type,
        delivery_type,
        order_channel: "totem",
        payment_type: paymentMethod === "cartao" ? "cartao_pendente" : paymentMethod,
        status: "pending",
        payment_status: "pending",
        notes,
        delivery_phone: customer.phone || null,
        coupon_code: appliedCoupon?.code || null,
        coupon_discount: couponDiscount,
        loyalty_points_used: loyaltyPointsUsed,
        reward_discount: pointsDiscount,
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error("[Kiosk] Order error:", orderError);
        throw orderError;
      }

      console.log("[Kiosk] Order created:", order.id, "→", consumptionMode === "table" ? "PDV" : "Pedidos");

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
          });
        }
      }

      // Update coupon usage
      if (appliedCoupon?.id) {
        await supabase.from("coupons").update({
          used_count: (appliedCoupon.used_count || 0) + 1,
        }).eq("id", appliedCoupon.id);
      }

      // Update loyalty if enabled
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
              customer_cpf: customer.cpf,
              restaurant_id: restaurant.id,
              order_id: order.id,
              points: pointsToEarn,
              type: "earn",
            });
          }
          if (loyaltyPointsUsed > 0) {
            await supabase.from("loyalty_transactions").insert({
              customer_cpf: customer.cpf,
              restaurant_id: restaurant.id,
              order_id: order.id,
              points: -loyaltyPointsUsed,
              type: "redeem",
            });
          }
        }
      }

      onOrderCreated(order.id);
    } catch (err: any) {
      console.error("[Kiosk] Order error:", err);
      toast.error(err?.message || "Erro ao finalizar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const allMethods = [
    { key: "dinheiro" as const, label: "Dinheiro", icon: Banknote, configKey: "payment_cash" as const },
    { key: "cartao" as const, label: "Cartão", icon: CreditCard, sublabel: "Pague na maquininha", configKey: "payment_card" as const },
  ];

  const methods = kioskConfig
    ? allMethods.filter(m => kioskConfig[m.configKey] !== false)
    : allMethods;

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

        <div className="space-y-3 mb-8">
          {methods.map(m => (
            <button
              key={m.key}
              onClick={() => setPaymentMethod(m.key)}
              className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                paymentMethod === m.key ? "shadow-lg" : "border-muted hover:border-muted-foreground/30"
              }`}
              style={paymentMethod === m.key ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: paymentMethod === m.key ? primaryColor : undefined }}>
                <m.icon className="h-6 w-6" style={{ color: paymentMethod === m.key ? "#fff" : undefined }} />
              </div>
              <div className="text-left">
                <span className="text-lg font-bold text-foreground">{m.label}</span>
                {m.sublabel && <p className="text-sm text-muted-foreground">{m.sublabel}</p>}
              </div>
            </button>
          ))}
        </div>

        {paymentMethod === "dinheiro" && (
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
            disabled={submitting || !canFinalize}
          >
            {submitting ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Finalizando...</> : "Finalizar Pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
}
