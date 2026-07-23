import { useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, X, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

interface CouponInputProps {
  restaurantId: string;
  subtotal: number;
  appliedCoupon: any;
  onApplyCoupon: (coupon: any) => void;
  primaryColor: string;
}

export interface CouponInputRef {
  applyCouponCode: (code: string) => void;
}

export const CouponInput = forwardRef<CouponInputRef, CouponInputProps>(({
  restaurantId,
  subtotal,
  appliedCoupon,
  onApplyCoupon,
  primaryColor,
}, ref) => {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);

  const validateCoupon = async (couponCode?: string) => {
    const codeToValidate = couponCode || code;
    if (!codeToValidate) return;

    setValidating(true);

    try {
      const { data: couponRows, error } = await (supabase as any).rpc("validate_coupon", {
        p_code: codeToValidate.toUpperCase(),
      });
      const data = Array.isArray(couponRows)
        ? couponRows.find((c: any) => c.restaurant_id === restaurantId && c.is_active) || couponRows[0]
        : couponRows;

      if (error || !data) {
        toast.error("Cupom inválido");
        setValidating(false);
        return;
      }

      // Validar data de validade
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        toast.error("Cupom expirado");
        setValidating(false);
        return;
      }

      // Validar limite de uso
      if (data.usage_limit && data.used_count >= data.usage_limit) {
        toast.error("Cupom já atingiu o limite de uso");
        setValidating(false);
        return;
      }

      // Validar valor mínimo
      if (data.min_order_value && subtotal < data.min_order_value) {
        toast.error(`Pedido mínimo de R$ ${data.min_order_value.toFixed(2)}`);
        setValidating(false);
        return;
      }

      // Criar objeto de cupom estendido
      const couponData: any = { ...data };

      // Se for cupom de item grátis, buscar dados do produto
      if (data.coupon_type === "free_product" && data.target_product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price, image_url")
          .eq("id", data.target_product_id)
          .maybeSingle();
        
        if (product) {
          couponData.freeProduct = product;
        }

        // Buscar variação se houver
        if (data.target_product_extra_id) {
          const { data: extra } = await supabase
            .from("product_extras")
            .select("id, name, price")
            .eq("id", data.target_product_extra_id)
            .maybeSingle();
          
          if (extra) {
            couponData.freeProductExtra = extra;
          }
        }

        // Buscar extra do novo sistema se houver
        if (data.target_extra_id) {
          const { data: extra } = await supabase
            .from("extra_category_items")
            .select("id, name, price")
            .eq("id", data.target_extra_id)
            .maybeSingle();
          
          if (extra) {
            couponData.freeProductExtra = extra;
          }
        }
      }

      onApplyCoupon(couponData);
      
      if (couponData.coupon_type === "free_product" && couponData.freeProduct) {
        const extraName = couponData.freeProductExtra ? ` (${couponData.freeProductExtra.name})` : "";
        toast.success(`${couponData.freeProduct.name}${extraName} será adicionado grátis!`);
      } else {
        toast.success(`Cupom ${couponData.code} aplicado!`);
      }
      setCode("");
    } catch (error) {
      toast.error("Erro ao validar cupom");
    } finally {
      setValidating(false);
    }
  };

  // Expose method to apply coupon from outside
  useImperativeHandle(ref, () => ({
    applyCouponCode: (couponCode: string) => {
      setCode(couponCode);
      validateCoupon(couponCode);
    }
  }));

  // Função para obter a descrição do cupom
  const getCouponDescription = () => {
    if (appliedCoupon.coupon_type === "free_product" && appliedCoupon.freeProduct) {
      const extraName = appliedCoupon.freeProductExtra ? ` (${appliedCoupon.freeProductExtra.name})` : "";
      return `${appliedCoupon.freeProduct.name}${extraName} GRÁTIS`;
    }
    if (appliedCoupon.coupon_type === "free_delivery") {
      return "Entrega GRÁTIS";
    }
    if (appliedCoupon.discount_type === "percentage") {
      return `${appliedCoupon.discount_value}% OFF`;
    }
    return `R$ ${appliedCoupon.discount_value.toFixed(2)} OFF`;
  };

  if (appliedCoupon) {
    const isFreeProduct = appliedCoupon.coupon_type === "free_product";
    
    return (
      <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isFreeProduct ? (
                <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Ticket className="w-5 h-5 text-green-600 dark:text-green-400" />
              )}
              <div>
                <p className="font-bold text-green-700 dark:text-green-300">
                  {appliedCoupon.code}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {getCouponDescription()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onApplyCoupon(null)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Cupom de desconto</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Digite o código"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
          />
          <Button
            onClick={() => validateCoupon()}
            disabled={validating || !code}
            style={{ backgroundColor: primaryColor, color: "white" }}
          >
            Aplicar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

CouponInput.displayName = "CouponInput";
