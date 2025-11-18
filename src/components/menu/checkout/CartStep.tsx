import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import { CartItem } from "@/types/menu";
import { ProductSuggestions } from "./ProductSuggestions";
import { CouponInput } from "./CouponInput";
import { LoyaltyPointsDisplay } from "./LoyaltyPointsDisplay";

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
}: CartStepProps) => {
  const subtotal = cart.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    return sum + (item.product.price + extrasTotal) * item.quantity;
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

  return (
    <div className="p-4 space-y-6">
      {/* Items */}
      <div>
        <h4 className="font-bold text-foreground mb-3">Itens adicionados</h4>
        <div className="space-y-3">
          {cart.map((item) => {
            const itemTotal =
              (item.product.price + item.extras.reduce((s, e) => s + e.price, 0)) *
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
                        <h5 className="font-bold text-sm text-foreground">
                          {item.product.name}
                        </h5>
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
                          style={{ color: restaurant.primary_color }}
                        >
                          R$ {itemTotal.toFixed(2)}
                        </p>
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
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Product Suggestions */}
      <ProductSuggestions
        restaurantId={restaurant.id}
        excludeIds={cart.map((item) => item.product.id)}
        primaryColor={restaurant.primary_color}
      />

      {/* Coupon */}
      <CouponInput
        restaurantId={restaurant.id}
        subtotal={subtotal}
        appliedCoupon={coupon}
        onApplyCoupon={onApplyCoupon}
        primaryColor={restaurant.primary_color}
      />

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
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto (fidelidade)</span>
              <span>-R$ {loyaltyDiscount.toFixed(2)}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Taxa de entrega será calculada no próximo passo
        </p>
        <Button
          onClick={onContinue}
          className="w-full h-12 text-base font-bold"
          style={{ backgroundColor: restaurant.primary_color, color: "white" }}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
};
