import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface PaymentStepProps {
  onBack: () => void;
  onContinue: (data: any) => void;
}

export const PaymentStep = ({ onBack, onContinue }: PaymentStepProps) => {
  const [paymentType, setPaymentType] = useState<"delivery" | "online">("delivery");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [changeFor, setChangeFor] = useState("");

  const paymentMethods = [
    { value: "cash", label: "Dinheiro", icon: Banknote },
    { value: "debit", label: "Cartão de Débito", icon: CreditCard },
    { value: "credit", label: "Cartão de Crédito", icon: CreditCard },
    { value: "pix", label: "PIX", icon: Smartphone },
  ];

  const handleContinue = () => {
    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    onContinue({
      type: paymentType,
      method: paymentMethod,
      changeFor: paymentMethod === "cash" ? changeFor : null,
    });
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">Como você quer pagar?</h2>

      {/* Payment Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${
            paymentType === "delivery"
              ? "border-primary bg-primary/5"
              : "hover:border-primary/50"
          }`}
          onClick={() => setPaymentType("delivery")}
        >
          <CardContent className="p-4">
            <h3 className="font-medium mb-1">Pagar na entrega</h3>
            <p className="text-sm text-muted-foreground">
              Quando você receber o pedido
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            paymentType === "online"
              ? "border-primary bg-primary/5"
              : "hover:border-primary/50"
          }`}
          onClick={() => setPaymentType("online")}
        >
          <CardContent className="p-4">
            <h3 className="font-medium mb-1">Pagar online</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Pague agora de forma segura
            </p>
            <Badge variant="secondary">Em breve</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods for Delivery */}
      {paymentType === "delivery" && (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <Card
              key={method.value}
              className={`cursor-pointer transition-colors ${
                paymentMethod === method.value
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setPaymentMethod(method.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <method.icon className="w-5 h-5" />
                  <span className="font-medium">{method.label}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {paymentMethod === "cash" && (
            <div className="mt-4">
              <Label htmlFor="changeFor">Troco para quanto?</Label>
              <Input
                id="changeFor"
                type="number"
                step="0.01"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value)}
                placeholder="Ex: 50.00"
              />
            </div>
          )}
        </div>
      )}

      {/* Online Payment (Coming Soon) */}
      {paymentType === "online" && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Em breve você poderá pagar online com cartão de crédito ou PIX
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!paymentMethod}
          className="flex-1"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
};
