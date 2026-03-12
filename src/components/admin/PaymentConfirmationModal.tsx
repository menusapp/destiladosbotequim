import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Printer, ShoppingCart, Percent, Banknote, CreditCard, Smartphone, Utensils } from "lucide-react";
import { toast } from "sonner";
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
  { code: "visa", name: "Visa", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/200px-Visa_Inc._logo.svg.png" },
  { code: "mastercard", name: "Mastercard", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" },
  { code: "elo", name: "Elo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/ELO_logo.svg/200px-ELO_logo.svg.png" },
  { code: "amex", name: "American Express", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/200px-American_Express_logo_%282018%29.svg.png" },
  { code: "hipercard", name: "Hipercard", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Hipercard_logo.svg/200px-Hipercard_logo.svg.png" },
  { code: "diners", name: "Diners Club", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Diners_Club_Logo3.svg/200px-Diners_Club_Logo3.svg.png" },
];

const MEAL_VOUCHER_BRANDS = [
  { code: "alelo", name: "Alelo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Alelo_logo.svg/200px-Alelo_logo.svg.png" },
  { code: "sodexo", name: "Sodexo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Sodexo_logo.svg/200px-Sodexo_logo.svg.png" },
  { code: "ticket", name: "Ticket", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Edenred_logo.svg/200px-Edenred_logo.svg.png" },
  { code: "vr", name: "VR", logo: "https://www.vr.com.br/assets/img/logo.svg" },
  { code: "pluxee", name: "Pluxee", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Sodexo_logo.svg/200px-Sodexo_logo.svg.png" },
  { code: "ifood", name: "iFood Benefícios", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/IFood_logo.svg/200px-IFood_logo.svg.png" },
];

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "cash", method_type: "cash", name: "Dinheiro", is_active: true, accepted_brands: null },
  { id: "pix", method_type: "pix", name: "PIX", is_active: true, accepted_brands: null },
  { id: "credit", method_type: "credit", name: "Cartão de Crédito", is_active: true, accepted_brands: null },
  { id: "debit", method_type: "debit", name: "Cartão de Débito", is_active: true, accepted_brands: null },
];

export const PaymentConfirmationModal = ({
  order,
  restaurantId,
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) => {
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePercentage, setServiceFeePercentage] = useState(0);
  const [selectedPayments, setSelectedPayments] = useState<Array<{ method: string; amount: number }>>([]);
  const [currentAmount, setCurrentAmount] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);
  const [loading, setLoading] = useState(true);

  const getBrandInfo = (brandCode: string) => {
    const allBrands = [...CARD_BRANDS, ...MEAL_VOUCHER_BRANDS];
    return allBrands.find(b => b.code === brandCode);
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch payment methods and restaurant config in parallel
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

  const subtotal = calculateSubtotal();
  const feeAmount = serviceFeeEnabled ? (subtotal * serviceFeePercentage) / 100 : 0;
  const total = subtotal + feeAmount;
  const paidAmount = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

  const addPayment = (methodName: string) => {
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

    setSelectedPayments([...selectedPayments, { method: methodName, amount: adjustedAmount }]);
    setCurrentAmount("");
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
      // Build concatenated payment methods string
      const allMethods = selectedPayments.map(p => p.method);
      const uniqueMethods = [...new Set(allMethods)];
      const paymentMethodStr = uniqueMethods.join(", ");

      const { error } = await supabase
        .from("orders")
        .update({ payment_type: paymentMethodStr })
        .eq("id", order.id);

      if (error) throw error;

      // Always create a new bill for table orders (triggers customer logout via realtime)
      if (order.table_id) {
        const comandaId = (order as any)._comanda_id || (order as any).comanda_id || null;
        const { error: billError } = await supabase.from("bills").insert({
          table_id: order.table_id,
          comanda_id: comandaId,
          subtotal: subtotal,
          service_fee: feeAmount,
          total_amount: total,
          payment_method: paymentMethodStr,
          status: "paid",
          paid_at: new Date().toISOString(),
        });
        if (billError) console.error("Erro ao criar conta:", billError);
      }

      // Create individual cash_movements for each split payment
      const { data: cashSession } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", order.restaurant_id || restaurantId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cashSession) {
        // Delete any existing trigger-created movement for this order to avoid duplicates
        await supabase.from("cash_movements")
          .delete()
          .eq("cash_session_id", cashSession.id)
          .like("description", `Pedido Local #${order.id}%`);

        // Insert one cash_movement per payment split
        for (const payment of selectedPayments) {
          await supabase.from("cash_movements").insert({
            cash_session_id: cashSession.id,
            restaurant_id: order.restaurant_id || restaurantId,
            movement_type: "entrada",
            amount: payment.amount,
            payment_method: payment.method,
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
          <DialogTitle className="text-xl">Finalizar atendimento</DialogTitle>
        </DialogHeader>

        {/* Resumo do pedido */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5" />
            <h3 className="font-semibold">Resumo do pedido</h3>
          </div>
          <div className="space-y-2 text-sm">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}x {item.products?.name || "Produto"}
                </span>
                <span>R$ {(item.price_at_order * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Subtotal dos produtos:</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Taxa de serviço (somente se ativada nas configurações) */}
        {serviceFeeEnabled && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5" />
                <span className="font-semibold">Taxa de serviço ({serviceFeePercentage}%)</span>
              </div>
              <span className="text-lg font-bold">R$ {feeAmount.toFixed(2)}</span>
            </div>
          </Card>
        )}

        {/* Formas de pagamento */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">📋 Formas de pagamento</h3>
          
          <div className="space-y-3">
            <div>
              <Label>Valor a adicionar</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={fillRemaining} disabled={remaining <= 0}>
                  Pagar Total
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paymentMethods.map((method) => {
                  const Icon = METHOD_ICONS[method.method_type] || CreditCard;
                  const hasBrands = method.accepted_brands && method.accepted_brands.length > 0;
                  
                  return (
                    <Button
                      key={method.id}
                      variant="outline"
                      onClick={() => addPayment(method.name)}
                      className="h-auto p-3 flex-col items-start text-left"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs font-medium truncate">{method.name}</span>
                      </div>
                      
                      {hasBrands && (
                        <div className="flex flex-wrap gap-1 mt-2 w-full">
                          {method.accepted_brands!.slice(0, 4).map((brandCode) => {
                            const brand = getBrandInfo(brandCode);
                            if (!brand) return null;
                            return (
                              <img 
                                key={brandCode}
                                src={brand.logo} 
                                alt={brand.name}
                                className="h-3 sm:h-4 w-auto object-contain"
                                title={brand.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            );
                          })}
                          {method.accepted_brands!.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{method.accepted_brands!.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}

            {selectedPayments.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Pagamentos adicionados:</p>
                {selectedPayments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{payment.method}</span>
                    <span>R$ {payment.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Totais */}
        <Card className="p-4 bg-primary/5">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold text-red-600">
            <span>Restante:</span>
            <span>R$ {remaining.toFixed(2)}</span>
          </div>
        </Card>

        {/* Ações */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2">
            <Printer className="w-4 h-4" />
            Imprimir resumo
          </Button>
          <Button
            onClick={handleConfirmPayment}
            disabled={remaining > 0.01}
            className="flex-1 gap-2"
          >
            ✓ Confirmar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
