import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Banknote, CreditCard, Smartphone, Utensils, ArrowLeft } from "lucide-react";

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

const CARD_BRANDS = [
  { code: "visa", name: "Visa" },
  { code: "mastercard", name: "Mastercard" },
  { code: "elo", name: "Elo" },
  { code: "amex", name: "American Express" },
  { code: "hipercard", name: "Hipercard" },
  { code: "diners", name: "Diners Club" },
];

const MEAL_VOUCHER_BRANDS = [
  { code: "alelo", name: "Alelo" },
  { code: "sodexo", name: "Sodexo" },
  { code: "ticket", name: "Ticket" },
  { code: "vr", name: "VR" },
  { code: "pluxee", name: "Pluxee" },
  { code: "ifood", name: "iFood Benefícios" },
];

type Step = "methods" | "brand-select" | "cash-input";

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
  const [step, setStep] = useState<Step>("methods");
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("methods");
      setPendingMethod(null);
      setCashReceived("");
    }
  }, [open]);

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

  const needsBrandSelection = (methodType: string) => {
    return ["credit", "debit", "meal_voucher", "voucher"].includes(methodType);
  };

  const getBrandsForMethod = (methodType: string) => {
    if (methodType === "credit" || methodType === "debit") return CARD_BRANDS;
    if (methodType === "meal_voucher" || methodType === "voucher") return MEAL_VOUCHER_BRANDS;
    return [];
  };

  const handleMethodClick = (method: PaymentMethod) => {
    if (needsBrandSelection(method.method_type)) {
      setPendingMethod(method);
      setStep("brand-select");
    } else if (method.method_type === "cash") {
      setPendingMethod(method);
      setCashReceived("");
      setStep("cash-input");
    } else {
      confirmPayment(method.name);
    }
  };

  const handleBrandSelect = (brand: { code: string; name: string }) => {
    if (!pendingMethod) return;
    const displayName = `${pendingMethod.name} - ${brand.name}`;
    confirmPayment(displayName);
  };

  const handleCashConfirm = () => {
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received < splitValue) {
      toast.error(`Valor mínimo: R$ ${splitValue.toFixed(2)}`);
      return;
    }
    const change = Math.round((received - splitValue) * 100) / 100;
    const displayName = change > 0
      ? `Dinheiro (Troco: R$ ${change.toFixed(2)})`
      : "Dinheiro";
    confirmPayment(displayName);
  };

  const confirmPayment = async (methodName: string) => {
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

  const cashChange = cashReceived
    ? Math.max(0, Math.round((parseFloat(cashReceived) - splitValue) * 100) / 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">
            Pagar R$ {splitValue.toFixed(2)}
          </DialogTitle>
        </DialogHeader>

        {step === "methods" && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {methods.map((m) => {
              const Icon = METHOD_ICONS[m.method_type] || CreditCard;
              return (
                <Button
                  key={m.id}
                  variant="outline"
                  className="h-auto p-3 flex-col gap-1"
                  onClick={() => handleMethodClick(m)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{m.name}</span>
                  {needsBrandSelection(m.method_type) && (
                    <span className="text-[10px] text-muted-foreground">Selecionar bandeira →</span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {step === "brand-select" && pendingMethod && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setStep("methods"); setPendingMethod(null); }}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">Bandeira — {pendingMethod.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {getBrandsForMethod(pendingMethod.method_type).map((brand) => (
                <Button
                  key={brand.code}
                  variant="outline"
                  className="h-auto p-3 flex-col gap-1"
                  onClick={() => handleBrandSelect(brand)}
                >
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">{brand.name}</span>
                </Button>
              ))}
            </div>
          </>
        )}

        {step === "cash-input" && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setStep("methods"); setPendingMethod(null); }}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">Pagamento em Dinheiro</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Valor recebido</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={splitValue.toFixed(2)}
                    className="pl-10 text-lg font-semibold h-12"
                    autoFocus
                  />
                </div>
              </div>

              {cashReceived && parseFloat(cashReceived) >= splitValue && cashChange > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recebido:</span>
                    <span className="font-medium">R$ {parseFloat(cashReceived).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-amber-700 dark:text-amber-400 mt-1">
                    <span>Troco:</span>
                    <span>R$ {cashChange.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {cashReceived && parseFloat(cashReceived) > 0 && parseFloat(cashReceived) < splitValue && (
                <Badge variant="destructive" className="w-full justify-center py-1">
                  Valor insuficiente — faltam R$ {(splitValue - parseFloat(cashReceived)).toFixed(2)}
                </Badge>
              )}

              <Button
                onClick={handleCashConfirm}
                disabled={!cashReceived || parseFloat(cashReceived) < splitValue}
                className="w-full h-11"
              >
                <Banknote className="w-4 h-4 mr-2" />
                Confirmar Pagamento
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
