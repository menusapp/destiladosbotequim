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

interface Props {
  cart: CartItem[];
  restaurant: any;
  customer: KioskCustomer;
  consumptionType: "dine_in" | "takeaway";
  tableNumber: string;
  primaryColor: string;
  cartTotal: number;
  onBack: () => void;
  onOrderCreated: (orderId: string) => void;
  kioskConfig?: KioskConfig | null;
}

export function KioskPayment({ cart, restaurant, customer, consumptionType, tableNumber, primaryColor, cartTotal, onBack, onOrderCreated, kioskConfig }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao" | "pix">("dinheiro");
  const [cashPaid, setCashPaid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const changeAmount = paymentMethod === "dinheiro" && cashPaid
    ? Math.max(0, parseFloat(cashPaid) - cartTotal)
    : 0;

  const canFinalize = paymentMethod !== "dinheiro" || !cashPaid || parseFloat(cashPaid) >= cartTotal;

  const handleFinalize = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Find or create a generic table for kiosk orders
      let tableId: string | null = null;
      if (tableNumber) {
        const { data: table } = await supabase
          .from("tables")
          .select("id")
          .eq("restaurant_id", restaurant.id)
          .eq("table_number", parseInt(tableNumber))
          .maybeSingle();
        tableId = table?.id || null;
      }

      const notes = [
        `[TOTEM] ${consumptionType === "dine_in" ? "Comer no local" : "Para viagem"}`,
        tableNumber ? `Mesa: ${tableNumber}` : null,
        paymentMethod === "dinheiro" && cashPaid ? `Troco para: R$ ${parseFloat(cashPaid).toFixed(2)}` : null,
      ].filter(Boolean).join(" | ");

      const orderData = {
        table_id: tableId,
        restaurant_id: restaurant.id,
        customer_name: customer.name,
        customer_cpf: customer.cpf,
        order_type: "kiosk",
        delivery_type: consumptionType === "takeaway" ? "pickup" : "local",
        payment_type: paymentMethod === "cartao" ? "cartao_pendente" : paymentMethod,
        status: "pending",
        payment_status: paymentMethod === "cartao" ? "pending" : "pending",
        notes,
        delivery_phone: customer.phone || null,
      };

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
          });
        }
      }

      // Update loyalty if enabled
      if (restaurant.loyalty_enabled && customer.cpf) {
        const pointsToEarn = Math.floor(cartTotal * (restaurant.loyalty_points_per_real || 1));
        if (pointsToEarn > 0) {
          const { data: existing } = await supabase
            .from("loyalty_points")
            .select("*")
            .eq("customer_cpf", customer.cpf)
            .eq("restaurant_id", restaurant.id)
            .single();

          if (existing) {
            await supabase.from("loyalty_points").update({
              points_balance: existing.points_balance + pointsToEarn,
              total_earned: existing.total_earned + pointsToEarn,
              last_updated: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            await supabase.from("loyalty_points").insert({
              customer_cpf: customer.cpf,
              restaurant_id: restaurant.id,
              points_balance: pointsToEarn,
              total_earned: pointsToEarn,
            });
          }

          await supabase.from("loyalty_transactions").insert({
            customer_cpf: customer.cpf,
            restaurant_id: restaurant.id,
            order_id: order.id,
            points: pointsToEarn,
            type: "earn",
          });
        }
      }

      onOrderCreated(order.id);
    } catch (err: any) {
      console.error("Kiosk order error:", err);
      toast.error(err?.message || "Erro ao finalizar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const methods = [
    { key: "dinheiro" as const, label: "Dinheiro", icon: Banknote },
    { key: "cartao" as const, label: "Cartão", icon: CreditCard, sublabel: "Pague na maquininha" },
  ];

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 p-6 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-14 w-14 rounded-full">
          <ArrowLeft className="h-8 w-8" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Pagamento</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-lg mx-auto w-full">
        <div className="text-center mb-8">
          <p className="text-lg text-muted-foreground">Total do pedido</p>
          <p className="text-4xl font-bold mt-1" style={{ color: primaryColor }}>R$ {cartTotal.toFixed(2)}</p>
        </div>

        <div className="space-y-4 mb-8">
          {methods.map(m => (
            <button
              key={m.key}
              onClick={() => setPaymentMethod(m.key)}
              className={`w-full p-6 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                paymentMethod === m.key ? "shadow-lg" : "border-muted hover:border-muted-foreground/30"
              }`}
              style={paymentMethod === m.key ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
            >
              <m.icon className="h-10 w-10" style={{ color: paymentMethod === m.key ? primaryColor : undefined }} />
              <div className="text-left">
                <span className="text-xl font-bold text-foreground">{m.label}</span>
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
              className="text-2xl h-16 text-center"
              inputMode="decimal"
            />
            {cashPaid && parseFloat(cashPaid) >= cartTotal && (
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                <p className="text-lg text-muted-foreground">Troco</p>
                <p className="text-3xl font-bold text-green-600">R$ {changeAmount.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t bg-card p-6">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleFinalize}
            className="w-full h-16 text-xl font-bold rounded-xl text-white"
            style={{ backgroundColor: primaryColor }}
            disabled={submitting || !canFinalize}
          >
            {submitting ? <><Loader2 className="h-6 w-6 animate-spin mr-2" />Finalizando...</> : "Finalizar Pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
}
