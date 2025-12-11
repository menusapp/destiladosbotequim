import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CartItem } from "@/types/menu";
import { MapPin, CreditCard, Clock, Gift } from "lucide-react";

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
  const deliveryFee = deliveryType === "delivery" ? (restaurant.delivery_fee || 0) : 0;
  const serviceFee = restaurant.service_fee_enabled
    ? (subtotal * restaurant.service_fee_percentage) / 100
    : 0;
  const total = subtotal - couponDiscount - loyaltyDiscount + deliveryFee + serviceFee;

  const pointsToEarn = Math.floor(subtotal * (restaurant.loyalty_points_per_real || 1));

  const getPaymentLabel = () => {
    const labels = {
      cash: "Dinheiro",
      debit: "Cartão de Débito",
      credit: "Cartão de Crédito",
      pix: "PIX",
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
                </span>
                <span className="font-medium">R$ {itemTotal.toFixed(2)}</span>
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
          <p className="text-sm">{getPaymentLabel()}</p>
          {paymentData.changeFor && (
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
              <span>R$ {deliveryFee.toFixed(2)}</span>
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
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Desconto fidelidade ({loyaltyPointsUsed} pontos)</span>
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
        <span>Tempo estimado: {restaurant.prep_time_minutes || 30}-45 minutos</span>
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
