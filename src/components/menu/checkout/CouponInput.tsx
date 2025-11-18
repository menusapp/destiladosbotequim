import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CouponInputProps {
  restaurantId: string;
  subtotal: number;
  appliedCoupon: any;
  onApplyCoupon: (coupon: any) => void;
  primaryColor: string;
}

export const CouponInput = ({
  restaurantId,
  subtotal,
  appliedCoupon,
  onApplyCoupon,
  primaryColor,
}: CouponInputProps) => {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);

  const validateCoupon = async () => {
    if (!code) return;

    setValidating(true);

    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .single();

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

      onApplyCoupon(data);
      toast.success(`Cupom ${data.code} aplicado!`);
      setCode("");
    } catch (error) {
      toast.error("Erro ao validar cupom");
    } finally {
      setValidating(false);
    }
  };

  if (appliedCoupon) {
    return (
      <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-bold text-green-700 dark:text-green-300">
                  {appliedCoupon.code}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {appliedCoupon.discount_type === "percentage"
                    ? `${appliedCoupon.discount_value}% OFF`
                    : `R$ ${appliedCoupon.discount_value} OFF`}
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
            onClick={validateCoupon}
            disabled={validating || !code}
            style={{ backgroundColor: primaryColor, color: "white" }}
          >
            Aplicar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
