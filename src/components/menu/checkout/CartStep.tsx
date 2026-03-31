import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, AlertCircle, Gift, X, Ticket } from "lucide-react";
import { CartItem } from "@/types/menu";
import { ProductSuggestions } from "./ProductSuggestions";
import { CouponInput, CouponInputRef } from "./CouponInput";
import { LoyaltyPointsDisplay } from "./LoyaltyPointsDisplay";
import { LoyaltyRewardNotification, DiscountReward } from "./LoyaltyRewardNotification";
import { toast } from "@/components/ui/sonner";

interface Reward {
  id: string;
  trigger_value: number;
  reward_type: string;
  reward_value: number | null;
  reward_product_id: string | null;
  description: string | null;
  product?: {
    id: string;
    name: string;
    image_url: string | null;
    price: number;
  };
}

interface CartStepProps {
  cart: CartItem[];
  restaurant: any;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  coupon: any;
  onApplyCoupon: (coupon: any) => void;
  loyaltyPoints: number;
  loyaltyPointsUsed: number;
  onRedeemPoints: (points: number) => void;
  onContinue: () => void;
  minOrderValue?: number;
  deliveryType?: "delivery" | "pickup";
  customerCPF?: string;
  onAddRewardItem?: (reward: Reward) => void;
  onRedeemDiscount?: (discount: DiscountReward) => void;
  activeRewardDiscount?: DiscountReward | null;
  onClearRewardDiscount?: () => void;
  onSuggestionClick?: (product: any) => void;
}

export const CartStep = ({
  cart,
  restaurant,
  onUpdateQuantity,
  onClearCart,
  coupon,
  onApplyCoupon,
  loyaltyPoints,
  loyaltyPointsUsed,
  onRedeemPoints,
  onContinue,
  minOrderValue = 0,
  deliveryType = "delivery",
  customerCPF,
  onAddRewardItem,
  onRedeemDiscount,
  activeRewardDiscount,
  onClearRewardDiscount,
  onSuggestionClick,
}: CartStepProps) => {
  const couponInputRef = useRef<CouponInputRef>(null);

  const handleUseCoupon = (couponCode: string) => {
    if (couponInputRef.current) {
      couponInputRef.current.applyCouponCode(couponCode);
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    // Reward items and coupon free items don't count towards subtotal (they're free)
    if (item.isRewardItem || item.isCouponFreeItem) return sum;
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
        return 0; // This is handled separately
      default:
        return 0;
    }
  };

  const rewardDiscount = getRewardDiscountValue();

  const getRewardDiscountLabel = (): string => {
    if (!activeRewardDiscount) return "";
    switch (activeRewardDiscount.type) {
      case "discount_percentage":
        return `${activeRewardDiscount.value}% de desconto`;
      case "discount_fixed":
        return `R$ ${activeRewardDiscount.value.toFixed(2)} de desconto`;
      case "free_delivery":
        return "Entrega grátis";
      default:
        return "Desconto fidelidade";
    }
  };

  // Verificar pedido mínimo apenas para delivery
  const effectiveMinOrder = deliveryType === "delivery" ? minOrderValue : 0;
  const meetsMinOrder = subtotal >= effectiveMinOrder;
  const amountNeeded = effectiveMinOrder - subtotal;

  const handleContinue = () => {
    if (!meetsMinOrder && deliveryType === "delivery") {
      toast.error(`Pedido mínimo para entrega: R$ ${effectiveMinOrder.toFixed(2).replace('.', ',')}`);
      return;
    }
    onContinue();
  };

  return (
    <div className="p-4 space-y-6">
      {/* Min Order Warning */}
      {!meetsMinOrder && effectiveMinOrder > 0 && deliveryType === "delivery" && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700">
                  Pedido mínimo: R$ {effectiveMinOrder.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs text-amber-600">
                  Adicione mais R$ {amountNeeded.toFixed(2).replace('.', ',')} para continuar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <div>
        <h4 className="font-bold text-foreground mb-3">Itens adicionados</h4>
        <div className="space-y-3">
          {cart.map((item) => {
            const effectivePrice = item.product.promotional_price ?? item.product.price;
            const itemTotal =
              (effectivePrice + item.extras.reduce((s, e) => s + e.price, 0)) *
              item.quantity;

            return (
              <Card key={item.id}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <h5 className="font-bold text-sm text-foreground">
                            {item.product.name}
                          </h5>
                          {item.isRewardItem && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              <Gift className="w-3 h-3" />
                              Recompensa Fidelidade
                            </span>
                          )}
                          {item.isCouponFreeItem && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <Ticket className="w-3 h-3" />
                              Cupom Grátis
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => onUpdateQuantity(item.id, -item.quantity)}
                          className="text-destructive flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.extras.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {item.extras.map((e) => e.name).join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Obs: {item.notes}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p
                          className="font-bold text-sm"
                          style={{ color: (item.isRewardItem || item.isCouponFreeItem) ? '#22c55e' : restaurant.primary_color }}
                        >
                          {(item.isRewardItem || item.isCouponFreeItem) ? "GRÁTIS" : `R$ ${itemTotal.toFixed(2)}`}
                        </p>
                        {!item.isRewardItem && !item.isCouponFreeItem && (
                          <div className="flex items-center gap-3 bg-accent/50 rounded-full px-3 py-1">
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="text-foreground"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-bold text-foreground min-w-[20px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              style={{ color: restaurant.primary_color }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Loyalty Points */}
      {restaurant.loyalty_enabled && (
        <LoyaltyPointsDisplay
          points={loyaltyPoints}
          pointsUsed={loyaltyPointsUsed}
          realPerPoint={restaurant.loyalty_real_per_point || 0.01}
          onRedeem={onRedeemPoints}
          primaryColor={restaurant.primary_color}
        />
      )}

      {/* Loyalty Reward Notification */}
      {customerCPF && onAddRewardItem && (
        <LoyaltyRewardNotification
          restaurantId={restaurant.id}
          customerCPF={customerCPF}
          primaryColor={restaurant.primary_color}
          onRedeemReward={onAddRewardItem}
          onRedeemDiscount={onRedeemDiscount}
          onUseCoupon={handleUseCoupon}
        />
      )}

      {/* Active Reward Discount Display */}
      {activeRewardDiscount && (
        <Card className="border-green-500 bg-green-500/10">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700">
                    {getRewardDiscountLabel()}
                  </p>
                  <p className="text-xs text-green-600">
                    Recompensa de fidelidade aplicada
                  </p>
                </div>
              </div>
              {onClearRewardDiscount && (
                <button
                  onClick={onClearRewardDiscount}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Suggestions */}
      <ProductSuggestions
        restaurantId={restaurant.id}
        excludeIds={cart.map((item) => item.product.id)}
        primaryColor={restaurant.primary_color}
        onProductClick={onSuggestionClick}
      />

      {/* Coupon */}
      <CouponInput
        ref={couponInputRef}
        restaurantId={restaurant.id}
        subtotal={subtotal}
        appliedCoupon={coupon}
        onApplyCoupon={onApplyCoupon}
        primaryColor={restaurant.primary_color}
      />

      {/* Summary */}
      <div className="border-t pt-4">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto (cupom)</span>
              <span>-R$ {couponDiscount.toFixed(2)}</span>
            </div>
          )}
          {rewardDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto (recompensa)</span>
              <span>-R$ {rewardDiscount.toFixed(2)}</span>
            </div>
          )}
          {activeRewardDiscount?.type === "free_delivery" && (
            <div className="flex justify-between text-green-600">
              <span>Entrega grátis (recompensa)</span>
              <span>✓</span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto (pontos)</span>
              <span>-R$ {loyaltyDiscount.toFixed(2)}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Taxa de entrega será calculada no próximo passo
        </p>
        <Button
          onClick={handleContinue}
          className="w-full h-12 text-base font-bold"
          style={{ backgroundColor: restaurant.primary_color, color: "white" }}
          disabled={!meetsMinOrder && deliveryType === "delivery" && effectiveMinOrder > 0}
        >
          {!meetsMinOrder && effectiveMinOrder > 0 && deliveryType === "delivery"
            ? `Faltam R$ ${amountNeeded.toFixed(2).replace('.', ',')}`
            : "Continuar"
          }
        </Button>
      </div>
    </div>
  );
};
