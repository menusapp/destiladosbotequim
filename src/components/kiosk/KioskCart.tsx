import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Minus, Plus, Trash2, Gift, Ticket } from "lucide-react";
import { CartItem } from "@/types/menu";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

interface Props {
  cart: CartItem[];
  primaryColor: string;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  cartTotal: number;
  onBack: () => void;
  onNext: () => void;
  customerCpf?: string;
  restaurantId?: string;
  appliedCoupon?: any;
  onApplyCoupon?: (coupon: any) => void;
  couponDiscount?: number;
  loyaltyPoints?: number;
  loyaltyPointsUsed?: number;
  loyaltyRealPerPoint?: number;
  onRedeemPoints?: (points: number) => void;
  isOpen?: boolean;
}

export function KioskCart({
  cart, primaryColor, onUpdateQuantity, onRemove, cartTotal, onBack, onNext,
  customerCpf, restaurantId, appliedCoupon, onApplyCoupon, couponDiscount = 0,
  loyaltyPoints = 0, loyaltyPointsUsed = 0, loyaltyRealPerPoint = 0.01, onRedeemPoints,
  isOpen = true,
}: Props) {
  const [couponCode, setCouponCode] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [pointsInput, setPointsInput] = useState("");

  const pointsDiscount = loyaltyPointsUsed * loyaltyRealPerPoint;
  const finalTotal = Math.max(0, cartTotal - couponDiscount - pointsDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode || !restaurantId) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) { toast.error("Cupom inválido"); return; }
      if (data.valid_until && new Date(data.valid_until) < new Date()) { toast.error("Cupom expirado"); return; }
      if (data.usage_limit && data.used_count >= data.usage_limit) { toast.error("Cupom esgotado"); return; }
      if (data.min_order_value && cartTotal < data.min_order_value) { toast.error(`Pedido mínimo: R$ ${data.min_order_value.toFixed(2)}`); return; }

      onApplyCoupon?.(data);
      setCouponCode("");
      toast.success(`Cupom ${data.code} aplicado!`);
    } catch { toast.error("Erro ao validar cupom"); } finally { setValidatingCoupon(false); }
  };

  const handleUsePoints = () => {
    const value = parseInt(pointsInput);
    const available = loyaltyPoints - loyaltyPointsUsed;
    if (!value || value <= 0) { toast.error("Quantidade inválida"); return; }
    if (value > available) { toast.error(`Máximo: ${available} pontos`); return; }
    onRedeemPoints?.(loyaltyPointsUsed + value);
    setPointsInput("");
    toast.success(`${value} pontos aplicados!`);
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-4 p-5 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-12 w-12 rounded-full">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h2 className="text-xl font-bold text-foreground">Seu Pedido</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl mb-4">🛒</p>
            <p className="text-xl text-muted-foreground">Seu carrinho está vazio</p>
            <Button variant="outline" className="mt-6 h-12 text-base px-8 rounded-xl" onClick={onBack}>Voltar ao cardápio</Button>
          </div>
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
        <h2 className="text-xl font-bold text-foreground">Seu Pedido</h2>
        <span className="ml-auto text-sm text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
          {/* Loyalty section */}
          {customerCpf && loyaltyPoints > 0 && (
            <div className="p-4 rounded-2xl border-2 bg-card" style={{ borderColor: `${primaryColor}40` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5" style={{ color: primaryColor }} />
                  <span className="font-bold text-foreground">Pontos de Fidelidade</span>
                </div>
                <span className="text-lg font-bold" style={{ color: primaryColor }}>{loyaltyPoints - loyaltyPointsUsed} pts</span>
              </div>
              {loyaltyPointsUsed > 0 ? (
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">{loyaltyPointsUsed} pontos = -R$ {pointsDiscount.toFixed(2)}</span>
                    <Button variant="ghost" size="sm" onClick={() => onRedeemPoints?.(0)} className="h-7 text-xs">Remover</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Quantos pontos?"
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                  <Button onClick={handleUsePoints} disabled={!pointsInput} className="h-10 rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
                    Usar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Coupon section */}
          {restaurantId && (
            <div className="p-4 rounded-2xl border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="h-5 w-5 text-muted-foreground" />
                <span className="font-bold text-foreground">Cupom de desconto</span>
              </div>
              {appliedCoupon ? (
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-300">{appliedCoupon.code}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_value}% OFF` : `R$ ${appliedCoupon.discount_value.toFixed(2)} OFF`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onApplyCoupon?.(null)} className="h-7 text-xs">Remover</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Código do cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="h-10 rounded-xl"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <Button onClick={handleApplyCoupon} disabled={validatingCoupon || !couponCode} className="h-10 rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
                    Aplicar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Cart items */}
          {cart.map(item => {
            const price = item.product.promotional_price ?? item.product.price;
            const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
            const itemTotal = (price + extrasTotal) * item.quantity;

            return (
              <div key={item.id} className="flex items-start gap-3 p-4 bg-card rounded-2xl border">
                {item.product.image_url && (
                  <img src={item.product.image_url} className="h-16 w-16 rounded-xl object-cover shrink-0" alt="" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base text-foreground truncate">{item.product.name}</p>
                  {item.extras.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">{item.extras.map(e => e.name).join(", ")}</p>
                  )}
                  {item.notes && <p className="text-xs text-muted-foreground italic">"{item.notes}"</p>}
                  <p className="font-bold text-base mt-1" style={{ color: primaryColor }}>R$ {itemTotal.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 bg-muted rounded-xl p-0.5">
                    <Button variant="ghost" size="icon" onClick={() => onUpdateQuantity(item.id, -1)} className="h-8 w-8 rounded-lg">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-bold w-6 text-center text-foreground">{item.quantity}</span>
                    <Button variant="ghost" size="icon" onClick={() => onUpdateQuantity(item.id, 1)} className="h-8 w-8 rounded-lg">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-4 md:p-5 shrink-0">
        <div className="max-w-2xl mx-auto">
          {(couponDiscount > 0 || pointsDiscount > 0) && (
            <div className="space-y-1 mb-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Cupom</span>
                  <span>-R$ {couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Pontos</span>
                  <span>-R$ {pointsDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium text-foreground">Total</span>
            <span className="text-2xl font-bold" style={{ color: primaryColor }}>R$ {finalTotal.toFixed(2)}</span>
          </div>
          <Button onClick={onNext} className="w-full h-14 text-lg font-bold rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
