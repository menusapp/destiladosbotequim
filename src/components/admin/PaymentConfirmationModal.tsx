import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Printer, ShoppingCart, Percent } from "lucide-react";
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
  order_items: OrderItem[];
}

interface PaymentConfirmationModalProps {
  order: Order;
  restaurantId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const PaymentConfirmationModal = ({
  order,
  restaurantId,
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) => {
  const [serviceFee, setServiceFee] = useState(10);
  const [selectedPayments, setSelectedPayments] = useState<Array<{ method: string; amount: number }>>([]);
  const [currentAmount, setCurrentAmount] = useState("");

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
  const feeAmount = (subtotal * serviceFee) / 100;
  const total = subtotal + feeAmount;
  const paidAmount = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  const addPayment = (method: string) => {
    const amount = parseFloat(currentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Digite um valor válido");
      return;
    }
    if (amount > remaining) {
      toast.error("Valor maior que o restante");
      return;
    }

    setSelectedPayments([...selectedPayments, { method, amount }]);
    setCurrentAmount("");
  };

  const handleConfirmPayment = async () => {
    if (remaining > 0) {
      toast.error("Ainda falta pagar R$ " + remaining.toFixed(2));
      return;
    }

    try {
      // Update order with payment info
      const primaryPayment = selectedPayments[0]?.method || "cash";
      const { error } = await supabase
        .from("orders")
        .update({ payment_type: primaryPayment })
        .eq("id", order.id);

      if (error) throw error;

      toast.success("Pagamento confirmado!");
      onConfirm();
    } catch (error) {
      console.error("Erro ao confirmar pagamento:", error);
      toast.error("Erro ao confirmar pagamento");
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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

        {/* Taxa de serviço */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5" />
              <span className="font-semibold">Taxa do garçom</span>
            </div>
            <span className="text-lg font-bold">R$ {feeAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={serviceFee}
              onChange={(e) => setServiceFee(parseFloat(e.target.value) || 0)}
              className="w-24"
              min="0"
              max="100"
              step="0.1"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Você pode ajustar ou remover a taxa
          </p>
        </Card>

        {/* Formas de pagamento */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">📋 Formas de pagamento</h3>
          
          <div className="space-y-3">
            <div>
              <Label>Valor a adicionar</Label>
              <Input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={() => addPayment("cash")}
                className="h-20 flex-col"
              >
                💵
                <span className="text-xs mt-1">Dinheiro</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addPayment("pix")}
                className="h-20 flex-col"
              >
                📱
                <span className="text-xs mt-1">PIX</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addPayment("credit_card")}
                className="h-20 flex-col"
              >
                💳
                <span className="text-xs mt-1">Crédito</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addPayment("debit_card")}
                className="h-20 flex-col"
              >
                💳
                <span className="text-xs mt-1">Débito</span>
              </Button>
            </div>

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
            disabled={remaining > 0}
            className="flex-1 gap-2"
          >
            ✓ Confirmar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
