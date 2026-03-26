import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Banknote, CreditCard, Smartphone, Utensils, ChevronDown, ChevronUp, QrCode, Globe, Mail } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethod {
  id: string;
  method_type: string;
  name: string;
  is_active: boolean;
  accepted_brands: string[];
}

interface OnlinePaymentConfig {
  enabled: boolean;
  accept_pix: boolean;
  accept_card: boolean;
  enable_for_delivery: boolean;
  connection_status: string;
}

interface PaymentStepProps {
  onBack: () => void;
  onContinue: (data: any) => void;
  requireCustomerInfo?: boolean;
  orderTotal?: number;
  restaurantId?: string;
  primaryColor?: string;
  customerCPF?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  pix: Smartphone,
  voucher: Utensils,
  meal_voucher: Utensils,
};

// Bandeiras de cartão de crédito/débito
const CARD_BRANDS = [
  { code: "visa", name: "Visa", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/200px-Visa_Inc._logo.svg.png" },
  { code: "mastercard", name: "Mastercard", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" },
  { code: "elo", name: "Elo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/ELO_logo.svg/200px-ELO_logo.svg.png" },
  { code: "amex", name: "American Express", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/200px-American_Express_logo_%282018%29.svg.png" },
  { code: "hipercard", name: "Hipercard", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Hipercard_logo.svg/200px-Hipercard_logo.svg.png" },
  { code: "diners", name: "Diners Club", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Diners_Club_Logo3.svg/200px-Diners_Club_Logo3.svg.png" },
];

// Bandeiras de vale-refeição
const MEAL_VOUCHER_BRANDS = [
  { code: "alelo", name: "Alelo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Alelo_logo.svg/200px-Alelo_logo.svg.png" },
  { code: "sodexo", name: "Sodexo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Sodexo_logo.svg/200px-Sodexo_logo.svg.png" },
  { code: "ticket", name: "Ticket", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Edenred_logo.svg/200px-Edenred_logo.svg.png" },
  { code: "vr", name: "VR", logo: "https://www.vr.com.br/assets/img/logo.svg" },
  { code: "pluxee", name: "Pluxee", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Sodexo_logo.svg/200px-Sodexo_logo.svg.png" },
  { code: "ifood", name: "iFood Benefícios", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/IFood_logo.svg/200px-IFood_logo.svg.png" },
];

const DEFAULT_METHODS = [
  { value: "cash", label: "Dinheiro", icon: Banknote, brands: [] },
  { value: "debit", label: "Cartão de Débito", icon: CreditCard, brands: [] },
  { value: "credit", label: "Cartão de Crédito", icon: CreditCard, brands: [] },
  { value: "pix", label: "PIX", icon: Smartphone, brands: [] },
];

export const PaymentStep = ({ 
  onBack, 
  onContinue, 
  requireCustomerInfo, 
  orderTotal = 0,
  restaurantId,
  primaryColor,
  customerCPF: cpfProp,
  customerName: nameProp,
  customerPhone: phoneProp,
  customerEmail: emailProp,
}: PaymentStepProps) => {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [customerName, setCustomerName] = useState(nameProp || "");
  const [customerCPF, setCustomerCPF] = useState(cpfProp || "");
  const [customerPhone, setCustomerPhone] = useState(phoneProp || "");
  const [availableMethods, setAvailableMethods] = useState<{ value: string; label: string; icon: any; brands: string[] }[]>(DEFAULT_METHODS);
  const [loading, setLoading] = useState(true);
  const [onlineConfig, setOnlineConfig] = useState<OnlinePaymentConfig | null>(null);
  const [customerEmail, setCustomerEmail] = useState(emailProp || "");
  const [emailFetched, setEmailFetched] = useState(false);

  const getBrandInfo = (brandCode: string) => {
    const allBrands = [...CARD_BRANDS, ...MEAL_VOUCHER_BRANDS];
    return allBrands.find(b => b.code === brandCode);
  };

  // Carregar métodos de pagamento ativos do restaurante + online config
  useEffect(() => {
    const fetchData = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      // Fetch local payment methods and online config in parallel
      const [methodsResult, onlineResult] = await Promise.all([
        supabase
          .from("payment_methods")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true),
        supabase
          .from("online_payment_config")
          .select("enabled, accept_pix, accept_card, enable_for_delivery, connection_status")
          .eq("restaurant_id", restaurantId)
          .maybeSingle(),
      ]);

      if (!methodsResult.error && methodsResult.data && methodsResult.data.length > 0) {
        const methods = methodsResult.data.map((m: PaymentMethod) => ({
          value: m.id,
          methodType: m.method_type,
          label: m.name,
          methodName: m.name,
          icon: METHOD_ICONS[m.method_type] || CreditCard,
          brands: m.accepted_brands || [],
        }));
        setAvailableMethods(methods);
      }

      // Set online config if available and active
      if (!onlineResult.error && onlineResult.data && onlineResult.data.enable_for_delivery && onlineResult.data.connection_status === "connected") {
        setOnlineConfig(onlineResult.data as OnlinePaymentConfig);
      }
      
      setLoading(false);
    };

    fetchData();
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
          if (profile.full_name && !nameProp) {
            setCustomerName(profile.full_name);
            sessionStorage.setItem("customer_name", profile.full_name);
          }
          if (profile.cpf && !cpfProp) {
            setCustomerCPF(profile.cpf);
            sessionStorage.setItem("customer_cpf", profile.cpf);
          }
          if (profile.phone && !phoneProp) {
            setCustomerPhone(profile.phone);
            sessionStorage.setItem("customer_phone", profile.phone);
          }
          return;
        }
      }
      
      // Only fill from sessionStorage if props didn't provide values
      if (requireCustomerInfo) {
        if (!nameProp) setCustomerName(sessionStorage.getItem("customer_name") || "");
        if (!cpfProp) setCustomerCPF(sessionStorage.getItem("customer_cpf") || "");
        if (!phoneProp) setCustomerPhone(sessionStorage.getItem("customer_phone") || "");
      }
    };
    
    loadUserData();
  }, [requireCustomerInfo, nameProp, cpfProp, phoneProp]);

  const handleContinue = () => {
    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    // Check if online method selected
    if (paymentMethod === "pix_online" || paymentMethod === "credit_card_online") {
      if (!customerEmail || !isValidEmail(customerEmail)) {
        toast.error("Informe um email válido para pagamento online");
        return;
      }
      if (requireCustomerInfo) {
        if (!customerName || !customerCPF) {
          toast.error("Preencha todos os dados");
          return;
        }
        sessionStorage.setItem("customer_name", customerName);
        sessionStorage.setItem("customer_cpf", customerCPF);
        sessionStorage.setItem("customer_phone", customerPhone);
      }

      // Save email to sessionStorage and CRM
      sessionStorage.setItem("customer_email", customerEmail);
      const cpf = customerCPF || cpfProp || sessionStorage.getItem("customer_cpf") || "";
      if (cpf && restaurantId) {
        supabase
          .from("customers")
          .update({ email: customerEmail })
          .eq("cpf", cpf.replace(/\D/g, ""))
          .eq("restaurant_id", restaurantId)
          .then(() => console.log("[PaymentStep] Email saved to CRM"));
      }

      onContinue({
        type: "delivery",
        method: paymentMethod,
        isOnlinePayment: true,
        onlineMethod: paymentMethod === "pix_online" ? "pix" : "credit_card",
        customerEmail,
      });
      return;
    }

    const selectedMethod = availableMethods.find(m => m.value === paymentMethod);
    const methodType = (selectedMethod as any)?.methodType || selectedMethod?.value;

    if (methodType === "cash") {
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
      if (!customerName || !customerCPF) {
        toast.error("Preencha todos os dados");
        return;
      }
      sessionStorage.setItem("customer_name", customerName);
      sessionStorage.setItem("customer_cpf", customerCPF);
      sessionStorage.setItem("customer_phone", customerPhone);
    }

    onContinue({
      type: "delivery",
      method: methodType,
      changeFor: methodType === "cash" ? changeFor : null,
    });
  };

  const isOnlineMethod = paymentMethod === "pix_online" || paymentMethod === "credit_card_online";
  const showOnlineSection = onlineConfig && (onlineConfig.accept_pix || onlineConfig.accept_card);
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Fetch email from CRM when online method is selected
  useEffect(() => {
    if (!isOnlineMethod || emailFetched || !restaurantId) return;
    const cpf = customerCPF || cpfProp || sessionStorage.getItem("customer_cpf") || "";
    if (!cpf) return;

    const fetchEmail = async () => {
      const { data } = await supabase
        .from("customers")
        .select("email")
        .eq("cpf", cpf.replace(/\D/g, ""))
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (data?.email && !customerEmail) {
        setCustomerEmail(data.email);
      }
      setEmailFetched(true);
    };
    fetchEmail();
  }, [isOnlineMethod, emailFetched, restaurantId, customerCPF, cpfProp, customerEmail]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {requireCustomerInfo && customerName && (
        <div className="pb-4 border-b">
          <p className="text-sm text-muted-foreground">
            Pedido para <span className="font-semibold text-foreground">{customerName}</span>
          </p>
        </div>
      )}
      
      <h2 className="text-xl font-bold">Como você quer pagar?</h2>

      {/* Local Payment Methods */}
      <div className="space-y-3">
        {availableMethods.length === 0 && !showOnlineSection ? (
          <Card className="p-4 border-amber-500 bg-amber-500/10">
            <p className="text-sm text-amber-700">
              Nenhuma forma de pagamento configurada
            </p>
          </Card>
        ) : (
          <>
            {availableMethods.length > 0 && (
              <>
                {showOnlineSection && (
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Na entrega / retirada
                  </p>
                )}
                {availableMethods.map((method) => {
                  const isSelected = paymentMethod === method.value;
                  const methodType = (method as any).methodType || method.value;
                  const hasBrands = method.brands && method.brands.length > 0;
                  const Icon = method.icon;
                  
                  return (
                    <Card
                      key={method.value}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setPaymentMethod(method.value)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{method.label}</span>
                          </div>
                          {hasBrands && (
                            isSelected ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )
                          )}
                        </div>
                        
                        {/* Gavetinha de bandeiras */}
                        {isSelected && hasBrands && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Bandeiras aceitas:</p>
                            <div className="flex flex-wrap gap-2">
                              {method.brands.map((brandCode) => {
                                const brand = getBrandInfo(brandCode);
                                if (!brand) return null;
                                return (
                                  <div 
                                    key={brandCode} 
                                    className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md"
                                  >
                                    <img 
                                      src={brand.logo} 
                                      alt={brand.name} 
                                      className="h-4 w-auto object-contain"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                    <span className="text-xs font-medium">{brand.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* Troco para dinheiro */}
        {paymentMethod && (() => {
          const selectedMethod = availableMethods.find(m => m.value === paymentMethod);
          const methodType = (selectedMethod as any)?.methodType || selectedMethod?.value;
          return methodType === "cash";
        })() && (
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

        {/* Email field for online payment */}
        {isOnlineMethod && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-2">
            <Label htmlFor="customerEmail" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email para pagamento <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="seu@email.com"
              className={customerEmail && !isValidEmail(customerEmail) ? "border-red-500" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Necessário para processar o pagamento online
            </p>
          </div>
        )}

        {/* Online Payment Methods */}
        {showOnlineSection && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Pagamento Online
              </span>
              <Separator className="flex-1" />
            </div>

            {onlineConfig.accept_pix && (
              <Card
                className={`cursor-pointer transition-colors ${
                  paymentMethod === "pix_online"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod("pix_online")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <QrCode className="w-5 h-5" />
                    <div>
                      <span className="font-medium">Pix Online</span>
                      <p className="text-xs text-muted-foreground">Pague instantaneamente via QR Code</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {onlineConfig.accept_card && (
              <Card
                className={`cursor-pointer transition-colors ${
                  paymentMethod === "credit_card_online"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod("credit_card_online")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5" />
                    <div>
                      <span className="font-medium">Cartão de Crédito Online</span>
                      <p className="text-xs text-muted-foreground">Pague com cartão de crédito agora</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 relative z-50 pointer-events-auto pb-safe" data-vaul-no-drag>
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Voltar
        </Button>
        <Button 
          className="flex-1" 
          onClick={handleContinue}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
};
