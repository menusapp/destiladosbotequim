import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard, Smartphone, Utensils } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethod {
  id: string;
  method_type: string;
  name: string;
  is_active: boolean;
}

interface PaymentStepProps {
  onBack: () => void;
  onContinue: (data: any) => void;
  requireCustomerInfo?: boolean;
  orderTotal?: number;
  restaurantId?: string;
}

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  pix: Smartphone,
  voucher: Utensils,
};

const DEFAULT_METHODS = [
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "debit", label: "Cartão de Débito", icon: CreditCard },
  { value: "credit", label: "Cartão de Crédito", icon: CreditCard },
  { value: "pix", label: "PIX", icon: Smartphone },
];

export const PaymentStep = ({ 
  onBack, 
  onContinue, 
  requireCustomerInfo, 
  orderTotal = 0,
  restaurantId 
}: PaymentStepProps) => {
  const [paymentType, setPaymentType] = useState<"delivery" | "online">("delivery");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCPF, setCustomerCPF] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [availableMethods, setAvailableMethods] = useState<{ value: string; label: string; icon: any }[]>(DEFAULT_METHODS);
  const [loading, setLoading] = useState(true);

  // Carregar métodos de pagamento ativos do restaurante
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

      if (!error && data && data.length > 0) {
        // Usar métodos configurados pelo admin
        const methods = data.map((m: PaymentMethod) => ({
          value: m.method_type,
          label: m.name,
          icon: METHOD_ICONS[m.method_type] || CreditCard,
        }));
        setAvailableMethods(methods);
      }
      // Se não há métodos configurados, usa os padrões
      
      setLoading(false);
    };

    fetchPaymentMethods();
  }, [restaurantId]);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, cpf, phone")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          if (profile.full_name) {
            setCustomerName(profile.full_name);
            sessionStorage.setItem("customer_name", profile.full_name);
          }
          if (profile.cpf) {
            setCustomerCPF(profile.cpf);
            sessionStorage.setItem("customer_cpf", profile.cpf);
          }
          if (profile.phone) {
            setCustomerPhone(profile.phone);
            sessionStorage.setItem("customer_phone", profile.phone);
          }
          return;
        }
      }
      
      if (requireCustomerInfo) {
        setCustomerName(sessionStorage.getItem("customer_name") || "");
        setCustomerCPF(sessionStorage.getItem("customer_cpf") || "");
        setCustomerPhone(sessionStorage.getItem("customer_phone") || "");
      }
    };
    
    loadUserData();
  }, [requireCustomerInfo]);

  const handleContinue = () => {
    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    if (paymentMethod === "cash") {
      if (!changeFor || changeFor.trim() === "") {
        toast.error("Informe o valor para troco");
        return;
      }
      
      const changeValue = parseFloat(changeFor);
      if (isNaN(changeValue) || changeValue <= 0) {
        toast.error("Digite um valor válido para o troco");
        return;
      }
      
      if (changeValue < orderTotal) {
        toast.error(`O valor para troco deve ser maior ou igual ao total do pedido (R$ ${orderTotal.toFixed(2).replace('.', ',')})`);
        return;
      }
    }

    if (requireCustomerInfo) {
      if (!customerName || !customerCPF || !customerPhone) {
        toast.error("Preencha todos os dados");
        return;
      }
      sessionStorage.setItem("customer_name", customerName);
      sessionStorage.setItem("customer_cpf", customerCPF);
      sessionStorage.setItem("customer_phone", customerPhone);
    }

    onContinue({
      type: paymentType,
      method: paymentMethod,
      changeFor: paymentMethod === "cash" ? changeFor : null,
    });
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {requireCustomerInfo && (
        <div className="space-y-4 pb-4 border-b">
          <h3 className="text-lg font-semibold">Seus Dados</h3>
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nome Completo</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Digite seu nome"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-cpf">CPF</Label>
            <Input
              id="customer-cpf"
              value={customerCPF}
              onChange={(e) => setCustomerCPF(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Telefone</Label>
            <Input
              id="customer-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>
        </div>
      )}
      
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
            <h3 className="font-medium mb-1">Pagar pessoalmente</h3>
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
          {availableMethods.length === 0 ? (
            <Card className="p-4 border-amber-500 bg-amber-500/10">
              <p className="text-sm text-amber-700">
                Nenhuma forma de pagamento configurada
              </p>
            </Card>
          ) : (
            availableMethods.map((method) => (
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
            ))
          )}

          {paymentMethod === "cash" && (
            <div className="mt-4">
              <Label htmlFor="changeFor">
                Troco para quanto? <span className="text-red-500">*</span>
              </Label>
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
          disabled={!paymentMethod || availableMethods.length === 0}
          className="flex-1"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
};