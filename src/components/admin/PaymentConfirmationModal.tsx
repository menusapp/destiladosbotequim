import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, ShoppingCart, Percent, Banknote, CreditCard, Smartphone, Utensils, X, ArrowLeft, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  products: { name: string } | null;
  order_item_extras: Array<{
    price_at_order: number;
  }>;
}

interface Order {
  id: string;
  table_id?: string;
  order_type?: string;
  restaurant_id?: string;
  order_items: OrderItem[];
}

interface PaymentMethod {
  id: string;
  method_type: string;
  name: string;
  is_active: boolean;
  accepted_brands: string[] | null;
}

interface PaymentConfirmationModalProps {
  order: Order;
  restaurantId: string;
  onClose: () => void;
  onConfirm: () => void;
}

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  pix: Smartphone,
  voucher: Utensils,
  meal_voucher: Utensils,
};

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

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "cash", method_type: "cash", name: "Dinheiro", is_active: true, accepted_brands: null },
  { id: "pix", method_type: "pix", name: "PIX", is_active: true, accepted_brands: null },
  { id: "credit", method_type: "credit", name: "Cartão de Crédito", is_active: true, accepted_brands: null },
  { id: "debit", method_type: "debit", name: "Cartão de Débito", is_active: true, accepted_brands: null },
];

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-700 dark:text-green-400",
  pix: "bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20 text-teal-700 dark:text-teal-400",
  credit: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  debit: "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-700 dark:text-purple-400",
  meal_voucher: "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  voucher: "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-700 dark:text-orange-400",
};

type Step = "methods" | "brand-select";

export const PaymentConfirmationModal = ({
  order,
  restaurantId,
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) => {
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePercentage, setServiceFeePercentage] = useState(0);
  const [selectedPayments, setSelectedPayments] = useState<Array<{ method: string; methodType: string; amount: number }>>([]);
  const [currentAmount, setCurrentAmount] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("methods");
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [methodsRes, restaurantRes] = await Promise.all([
        supabase.from("payment_methods").select("*").eq("restaurant_id", restaurantId).eq("is_active", true),
        supabase.from("restaurants").select("service_fee_enabled, service_fee_percentage").eq("id", restaurantId).single(),
      ]);

      if (!methodsRes.error && methodsRes.data && methodsRes.data.length > 0) {
        setPaymentMethods(methodsRes.data);
      }

      if (!restaurantRes.error && restaurantRes.data) {
        const enabled = restaurantRes.data.service_fee_enabled ?? false;
        setServiceFeeEnabled(enabled);
        setServiceFeePercentage(enabled ? (restaurantRes.data.service_fee_percentage ?? 10) : 0);
      }

      setLoading(false);
    };

    fetchData();
  }, [restaurantId]);

  const calculateSubtotal = () => {
    return order.order_items.reduce((total, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras.reduce(
        (sum, extra) => sum + extra.price_at_order,
        0
      ) * item.quantity;
      return total + itemTotal + extrasTotal;
    }, 0);
  };

  const splitsPaidTotal = (order as any)._splits_paid_total || 0;
  const subtotal = calculateSubtotal();
  const feeAmount = serviceFeeEnabled ? (subtotal * serviceFeePercentage) / 100 : 0;
  const grossTotal = subtotal + feeAmount;
  const total = Math.max(0, Math.round((grossTotal - splitsPaidTotal) * 100) / 100);
  const paidAmount = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

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
    } else {
      addPayment(method.name, method.method_type);
    }
  };

  const handleBrandSelect = (brandName: string) => {
    if (!pendingMethod) return;
    const displayName = `${pendingMethod.name} - ${brandName}`;
    addPayment(displayName, pendingMethod.method_type);
    setStep("methods");
    setPendingMethod(null);
  };

  const addPayment = (methodName: string, methodType: string) => {
    const amount = parseFloat(currentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Digite um valor válido");
      return;
    }
    if (amount > remaining + 0.01) {
      toast.error("Valor maior que o restante");
      return;
    }
    const adjustedAmount = Math.min(amount, remaining);
    setSelectedPayments([...selectedPayments, { method: methodName, methodType, amount: adjustedAmount }]);
    setCurrentAmount("");
  };

  const removePayment = (idx: number) => {
    setSelectedPayments(selectedPayments.filter((_, i) => i !== idx));
  };

  const fillRemaining = () => {
    if (remaining > 0) {
      setCurrentAmount(remaining.toFixed(2));
    }
  };

  const handleConfirmPayment = async () => {
    if (remaining > 0.01) {
      toast.error("Ainda falta pagar R$ " + remaining.toFixed(2));
      return;
    }

    try {
      const allMethodNames = selectedPayments.map(p => p.method);
      const uniqueNames = [...new Set(allMethodNames)];
      const paymentDisplayStr = uniqueNames.join(", ");

      const allMethodTypes = selectedPayments.map(p => p.methodType);
      const uniqueTypes = [...new Set(allMethodTypes)];
      const billPaymentMethod = uniqueTypes.length === 1 ? uniqueTypes[0] : null;

      const { error } = await supabase
        .from("orders")
        .update({ payment_type: paymentDisplayStr })
        .eq("id", order.id);

      if (error) throw error;

      if (order.table_id) {
        const comandaId = (order as any)._comanda_id || (order as any).comanda_id || null;
        const { error: billError } = await supabase.from("bills").insert({
          table_id: order.table_id,
          comanda_id: comandaId,
          subtotal: subtotal,
          service_fee: feeAmount,
          total_amount: grossTotal,
          payment_method: billPaymentMethod,
          status: "paid",
          paid_at: new Date().toISOString(),
        });
        if (billError) console.error("Erro ao criar conta:", billError);
      }

      const { data: cashSession } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", order.restaurant_id || restaurantId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cashSession) {
        await supabase.from("cash_movements")
          .delete()
          .eq("cash_session_id", cashSession.id)
          .like("description", `Pedido Local #${order.id}%`);

        for (const payment of selectedPayments) {
          await supabase.from("cash_movements").insert({
            cash_session_id: cashSession.id,
            restaurant_id: order.restaurant_id || restaurantId,
            movement_type: "entrada",
            amount: payment.amount,
            payment_method: payment.methodType,
            category: "Pedido",
            description: `Pedido Local #${order.id} - ${payment.method} (R$ ${payment.amount.toFixed(2)})`,
            created_by: "Sistema",
          });
        }
      }

      toast.success("Pagamento confirmado!");
      onConfirm();
    } catch (error) {
      console.error("Erro ao confirmar pagamento:", error);
      toast.error("Erro ao confirmar pagamento");
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">💰 Finalizar Pagamento</DialogTitle>
        </DialogHeader>

        {/* Order Summary */}
        <Card className="p-4 border-2">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">Resumo do Pedido</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            {order.order_items.map((item) => {
              const extrasTotal = item.order_item_extras.reduce((s, e) => s + e.price_at_order, 0) * item.quantity;
              const itemTotal = item.price_at_order * item.quantity + extrasTotal;
              return (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{item.quantity}x</span> {item.products?.name || "Produto"}
                  </span>
                  <span className="font-medium">R$ {itemTotal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
            </div>
            {serviceFeeEnabled && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Percent className="w-3 h-3" /> Taxa de serviço ({serviceFeePercentage}%):
                </span>
                <span className="font-medium">R$ {feeAmount.toFixed(2)}</span>
              </div>
            )}
            {splitsPaidTotal > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Já pago via divisões:</span>
                <span className="font-medium">- R$ {splitsPaidTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t">
              <span>Total:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Payment Methods / Brand Selection */}
        <Card className="p-4 border-2">
          {step === "methods" ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Forma de Pagamento</h3>
                {remaining > 0 && (
                  <Badge variant="destructive" className="text-sm px-3 py-1">
                    Falta: R$ {remaining.toFixed(2)}
                  </Badge>
                )}
                {remaining <= 0.01 && selectedPayments.length > 0 && (
                  <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                    <Check className="w-3 h-3 mr-1" /> Pago
                  </Badge>
                )}
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <Label className="text-sm font-medium mb-1.5 block">Valor</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                    <Input
                      type="number"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      placeholder="0,00"
                      step="0.01"
                      className="pl-10 text-lg font-semibold h-12"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={fillRemaining}
                    disabled={remaining <= 0}
                    className="h-12 px-4 whitespace-nowrap"
                  >
                    Valor Total
                  </Button>
                </div>
              </div>

              {/* Method buttons */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map((method) => {
                    const Icon = METHOD_ICONS[method.method_type] || CreditCard;
                    const colorClass = METHOD_COLORS[method.method_type] || "bg-muted/50 border-border hover:bg-muted";
                    const needsBrand = needsBrandSelection(method.method_type);

                    return (
                      <button
                        key={method.id}
                        onClick={() => handleMethodClick(method)}
                        disabled={remaining <= 0 || !currentAmount || parseFloat(currentAmount) <= 0}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${colorClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-background/80 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{method.name}</p>
                          {needsBrand && (
                            <p className="text-[11px] opacity-70">Selecionar bandeira →</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Brand selection step */
            <>
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => { setStep("methods"); setPendingMethod(null); }}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-bold text-base">
                  Selecione a bandeira — {pendingMethod?.name}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {getBrandsForMethod(pendingMethod?.method_type || "").map((brand) => (
                  <button
                    key={brand.code}
                    onClick={() => handleBrandSelect(brand.name)}
                    className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="font-semibold text-sm">{brand.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Added Payments */}
        {selectedPayments.length > 0 && (
          <Card className="p-4 border-2 border-green-500/30 bg-green-500/5">
            <h3 className="font-bold text-sm mb-3 text-green-700 dark:text-green-400">
              ✅ Pagamentos Registrados
            </h3>
            <div className="space-y-2">
              {selectedPayments.map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{payment.method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">R$ {payment.amount.toFixed(2)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removePayment(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Total pago:</span>
                <span className="font-bold">R$ {paidAmount.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 gap-2 h-12" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmPayment}
            disabled={remaining > 0.01}
            className="flex-1 gap-2 h-12 text-base font-bold"
          >
            <Check className="w-5 h-5" />
            Confirmar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
