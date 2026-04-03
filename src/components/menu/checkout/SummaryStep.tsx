import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { CartItem } from "@/types/menu";
import { MapPin, CreditCard, Clock, Gift, CheckCircle2, CalendarClock } from "lucide-react";
import { DiscountReward } from "./LoyaltyRewardNotification";

interface DeliveryZone {
  id: string;
  zone_name: string;
  delivery_fee: number;
  min_order_value: number;
  estimated_time_minutes: number;
}

interface SummaryStepProps {
  cart: CartItem[];
  restaurant: any;
  customerData: any;
  addressData: any;
  paymentData: any;
  coupon: any;
  loyaltyPointsUsed: number;
  deliveryType: "delivery" | "pickup";
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
  deliveryZone?: DeliveryZone | null;
  activeRewardDiscount?: DiscountReward | null;
}

export const SummaryStep = ({
  cart,
  restaurant,
  customerData,
  addressData,
  paymentData,
  coupon,
  loyaltyPointsUsed,
  deliveryType,
  onBack,
  onConfirm,
  submitting,
  deliveryZone,
  activeRewardDiscount,
}: SummaryStepProps) => {
  const subtotal = cart.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const effectivePrice = item.product.promotional_price ?? item.product.price;
    return sum + (effectivePrice + extrasTotal) * item.quantity;
  }, 0);

  const couponDiscount = coupon
    ? coupon.discount_type === "percentage"
      ? Math.min(
          subtotal * (coupon.discount_value / 100),
          coupon.max_discount || Infinity
        )
      : coupon.discount_value
    : 0;

  const loyaltyDiscount = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
  
  // Calculate reward discount
  const getRewardDiscountValue = (): number => {
    if (!activeRewardDiscount) return 0;
    switch (activeRewardDiscount.type) {
      case "discount_percentage":
        return subtotal * (activeRewardDiscount.value / 100);
      case "discount_fixed":
        return Math.min(activeRewardDiscount.value, subtotal);
      case "free_delivery":
        return 0; // Handled in deliveryFee
      default:
        return 0;
    }
  };

  const rewardDiscount = getRewardDiscountValue();

  const getRewardDiscountLabel = (): string => {
    if (!activeRewardDiscount) return "";
    switch (activeRewardDiscount.type) {
      case "discount_percentage":
        return `Desconto recompensa (${activeRewardDiscount.value}%)`;
      case "discount_fixed":
        return "Desconto recompensa";
      case "free_delivery":
        return "Entrega grátis (recompensa)";
      default:
        return "Desconto recompensa";
    }
  };
  
  // Usar taxa da zona de entrega se disponível, or 0 if free delivery
  const deliveryFee = deliveryType === "delivery" 
    ? (activeRewardDiscount?.type === "free_delivery" 
        ? 0 
        : (deliveryZone?.delivery_fee ?? restaurant.delivery_fee ?? 0))
    : 0;
  
  const serviceFee = restaurant.service_fee_enabled
    ? (subtotal * restaurant.service_fee_percentage) / 100
    : 0;
  const total = subtotal - couponDiscount - loyaltyDiscount - rewardDiscount + deliveryFee + serviceFee;

  const pointsToEarn = Math.floor(subtotal * (restaurant.loyalty_points_per_real || 1));

  // Tempo estimado: usar da zona se disponível
  const estimatedTime = deliveryZone?.estimated_time_minutes ?? restaurant.prep_time_minutes ?? 30;

  const getPaymentLabel = () => {
    if (paymentData.isOnlinePayment) {
      return paymentData.onlineMethod === "pix" ? "Pix Online" : "Cartão de Crédito Online";
    }
    const labels = {
      cash: "Dinheiro",
      debit: "Cartão de Débito",
      credit: "Cartão de Crédito",
      pix: "PIX",
      voucher: "Vale Refeição",
    };
    return labels[paymentData.method as keyof typeof labels] || paymentData.method;
  };

  const formatAddress = () => {
    if (deliveryType === "pickup") {
      return restaurant.store_address || "Retirada na loja";
    }
    const addr = addressData.address;
    return `${addr.street}, ${addr.number}${addr.complement ? `, ${addr.complement}` : ""} - ${addr.neighborhood}, ${addr.city}/${addr.state}`;
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Confirme seu pedido</h2>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens do pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cart.map((item) => {
            const effectivePrice = item.product.promotional_price ?? item.product.price;
            const itemTotal =
              (effectivePrice + item.extras.reduce((s, e) => s + e.price, 0)) *
              item.quantity;

            return (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}x {item.product.name}
                  {item.extras.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      + {item.extras.map((e) => e.name).join(", ")}
                    </span>
                  )}
                  {item.isRewardItem && (
                    <span className="text-green-600 ml-1">(Recompensa)</span>
                  )}
                </span>
                <span className={`font-medium ${item.isRewardItem ? 'text-green-600' : ''}`}>
                  {item.isRewardItem ? "GRÁTIS" : `R$ ${itemTotal.toFixed(2)}`}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {deliveryType === "pickup" ? "Local de retirada" : "Endereço de entrega"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{formatAddress()}</p>
          {deliveryType === "delivery" ? (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                CEP: {addressData.address.zip_code}
              </p>
              <p className="text-sm text-muted-foreground">
                Telefone: {customerData.phone}
              </p>
              {deliveryZone && (
                <p className="text-sm text-muted-foreground">
                  Região: {deliveryZone.zone_name}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {customerData.name} - {customerData.phone}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Forma de pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm flex items-center gap-2">
            {paymentData.isOnlinePayment && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
            {getPaymentLabel()}
            {paymentData.isOnlinePayment && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Pago
              </span>
            )}
          </p>
          {paymentData.changeFor && !paymentData.isOnlinePayment && (
            <p className="text-sm text-muted-foreground">
              Troco para: R$ {paymentData.changeFor}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo de valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          {deliveryType === "delivery" && (
            <div className="flex justify-between text-sm">
              <span>Taxa de entrega</span>
              <span className={activeRewardDiscount?.type === "free_delivery" ? "text-green-600" : ""}>
                {activeRewardDiscount?.type === "free_delivery" 
                  ? "GRÁTIS" 
                  : `R$ ${deliveryFee.toFixed(2)}`}
              </span>
            </div>
          )}
          {serviceFee > 0 && (
            <div className="flex justify-between text-sm">
              <span>Taxa de serviço ({restaurant.service_fee_percentage}%)</span>
              <span>R$ {serviceFee.toFixed(2)}</span>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Desconto ({coupon.code})</span>
              <span>-R$ {couponDiscount.toFixed(2)}</span>
            </div>
          )}
          {rewardDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>{getRewardDiscountLabel()}</span>
              <span>-R$ {rewardDiscount.toFixed(2)}</span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Desconto pontos ({loyaltyPointsUsed} pontos)</span>
              <span>-R$ {loyaltyDiscount.toFixed(2)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Loyalty Points to Earn */}
      {restaurant.loyalty_enabled && pointsToEarn > 0 && (
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">
                Você vai ganhar {pointsToEarn} pontos neste pedido!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estimated Time */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Tempo estimado: {estimatedTime}-{estimatedTime + 15} minutos</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={submitting}>
          Voltar
        </Button>
        <Button
          onClick={onConfirm}
          className="flex-1"
          disabled={submitting}
          style={{ backgroundColor: restaurant.primary_color, color: "white" }}
        >
          {submitting ? "Finalizando..." : "Finalizar Pedido"}
        </Button>
      </div>
    </div>
  );
};
