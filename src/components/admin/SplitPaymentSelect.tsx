import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Banknote, CreditCard, Smartphone, Utensils } from "lucide-react";

interface PaymentMethod {
  id: string;
  method_type: string;
  name: string;
}

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  pix: Smartphone,
  voucher: Utensils,
  meal_voucher: Utensils,
};

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "cash", method_type: "cash", name: "Dinheiro" },
  { id: "pix", method_type: "pix", name: "PIX" },
  { id: "credit", method_type: "credit", name: "Cartão de Crédito" },
  { id: "debit", method_type: "debit", name: "Cartão de Débito" },
];

interface SplitPaymentSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  splitId: string;
  splitValue: number;
  restaurantId: string;
  onPaid: () => void;
}

export function SplitPaymentSelect({
  open, onOpenChange, splitId, splitValue, restaurantId, onPaid,
}: SplitPaymentSelectProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);

  useEffect(() => {
    supabase
      .from("payment_methods")
      .select("id, method_type, name")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) setMethods(data);
      });
  }, [restaurantId]);

  const handleSelect = async (methodName: string) => {
    const { error } = await supabase
      .from("order_item_splits" as any)
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_type: methodName,
      })
      .eq("id", splitId);

    if (error) {
      toast.error("Erro ao registrar pagamento");
      return;
    }
    toast.success("Pagamento registrado");
    onPaid();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">
            Pagar R$ {splitValue.toFixed(2)}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {methods.map((m) => {
            const Icon = METHOD_ICONS[m.method_type] || CreditCard;
            return (
              <Button
                key={m.id}
                variant="outline"
                className="h-auto p-3 flex-col gap-1"
                onClick={() => handleSelect(m.name)}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{m.name}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
