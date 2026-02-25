import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Copy, CheckCircle2, AlertCircle, CreditCard, Smartphone, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CartItemForPayment {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface OnlinePaymentStepProps {
  onBack: () => void;
  onConfirm: (onlinePaymentId: string) => void;
  method: "pix" | "credit_card";
  amount: number;
  restaurantId: string;
  orderId?: string;
  customerName: string;
  customerCPF: string;
  customerPhone: string;
  customerEmail?: string;
  primaryColor?: string;
  cartItems?: CartItemForPayment[];
}

export const OnlinePaymentStep = ({
  onBack,
  onConfirm,
  method,
  amount,
  restaurantId,
  orderId,
  customerName,
  customerCPF,
  customerPhone,
  customerEmail,
  primaryColor,
  cartItems,
}: OnlinePaymentStepProps) => {
  // PIX state
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string | null>(null);
  const [pixExpiration, setPixExpiration] = useState<string | null>(null);
  const [onlinePaymentId, setOnlinePaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "waiting" | "confirmed" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Credit card state
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardHolderCpf, setCardHolderCpf] = useState(customerCPF);
  const [cardHolderEmail, setCardHolderEmail] = useState(customerEmail || "");
  const [cardHolderPhone, setCardHolderPhone] = useState(customerPhone);
  const [cardHolderPostalCode, setCardHolderPostalCode] = useState("");
  const [cardHolderAddressNumber, setCardHolderAddressNumber] = useState("");
  const [processing, setProcessing] = useState(false);
  const [mpReady, setMpReady] = useState(false);

  // Secure Fields refs
  const mpInstanceRef = useRef<any>(null);
  const secureFieldsRef = useRef<any[]>([]);

  // Timer for PIX expiration
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds

  useEffect(() => {
    if (method === "pix") {
      createPixCharge();
    } else {
      setPaymentStatus("waiting");
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Initialize Mercado Pago Secure Fields for credit card
  useEffect(() => {
    if (method !== "credit_card") return;
    let isCancelled = false;

    const initMP = async () => {
      await new Promise((r) => setTimeout(r, 800)); // Delay um pouco maior para o Modal
      if (isCancelled) return;

      const checkContainer = () => document.getElementById("mp-card-number");
      if (!checkContainer()) {
        setTimeout(initMP, 200);
        return;
      }

      try {
        const { data: config } = await supabase
          .from("online_payment_config")
          .select("mp_public_key")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (!config?.mp_public_key || isCancelled) return;

        // Limpeza segura: desmonsta o que já existir
        secureFieldsRef.current.forEach((f) => {
          try {
            f.unmount();
          } catch (e) {}
        });
        secureFieldsRef.current = [];

        const mp = new (window as any).MercadoPago(config.mp_public_key);
        mpInstanceRef.current = mp;

        const style = {
          fontSize: "16px",
          color: "#333333",
          placeholderColor: "#999999",
          width: "100%",
          height: "100%",
        };

        const cardNumber = mp.fields.create("cardNumber", { placeholder: "0000 0000 0000 0000", style });
        const expirationDate = mp.fields.create("expirationDate", { placeholder: "MM/AA", style });
        const securityCode = mp.fields.create("securityCode", { placeholder: "CVV", style });

        cardNumber.mount("mp-card-number");
        expirationDate.mount("mp-expiration-date");
        securityCode.mount("mp-security-code");

        // Salva como ARRAY para o forEach funcionar
        secureFieldsRef.current = [cardNumber, expirationDate, securityCode];
        setMpReady(true);
      } catch (err) {
        console.error("Erro MP:", err);
      }
    };

    initMP();

    return () => {
      isCancelled = true;
      secureFieldsRef.current.forEach((f) => {
        try {
          f.unmount();
        } catch (e) {}
      });
      secureFieldsRef.current = [];
      setMpReady(false);
    };
  }, [method, restaurantId]);

  const createPixCharge = async () => {
    try {
      if (amount < 1) {
        setPaymentStatus("error");
        setErrorMessage("O valor mínimo para pagamento online é de R$ 1,00.");
        return;
      }
      setPaymentStatus("loading");
      const { data, error } = await supabase.functions.invoke("mercadopago-charge", {
        body: {
          restaurant_id: restaurantId,
          order_id: orderId,
          amount,
          billing_type: "PIX",
          customer_name: customerName,
          customer_cpf: customerCPF,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          items: cartItems,
        },
      });

      if (error) throw error;

      if (data?.error) {
        setPaymentStatus("error");
        setErrorMessage(data.error);
        return;
      }

      setPixQrCode(data.pix_qr_code);
      setPixQrCodeBase64(data.pix_qr_code_base64);
      setPixExpiration(data.pix_expiration);
      setOnlinePaymentId(data.online_payment_id);
      setPaymentStatus("waiting");

      // Start polling for payment confirmation
      if (data.online_payment_id) {
        startPolling(data.online_payment_id);
      }
    } catch (error: any) {
      console.error("[OnlinePayment] Error creating PIX charge:", error);
      setPaymentStatus("error");
      setErrorMessage(error.message || "Erro ao gerar QR Code Pix");
    }
  };

  const startPolling = (paymentId: string) => {
    pollingRef.current = setInterval(async () => {
      const { data, error } = await supabase.from("online_payments").select("status").eq("id", paymentId).maybeSingle();

      if (!error && data?.status === "confirmed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPaymentStatus("confirmed");
        toast.success("Pagamento confirmado! ✅");
        setTimeout(() => onConfirm(paymentId), 1500);
      }
    }, 5000);
  };

  const handleCopyPixCode = () => {
    if (pixQrCode) {
      navigator.clipboard.writeText(pixQrCode);
      toast.success("Código Pix copiado!");
    }
  };

  const handleCreditCardPayment = async () => {
    if (!cardHolderName) {
      toast.error("Preencha o nome no cartão");
      return;
    }

    if (!cardHolderCpf || !cardHolderPostalCode || !cardHolderAddressNumber) {
      toast.error("Preencha CPF, CEP e número do endereço do titular");
      return;
    }

    if (!mpInstanceRef.current || !mpReady) {
      toast.error("Campos do cartão ainda carregando. Aguarde.");
      return;
    }

    if (amount < 1) {
      toast.error("O valor mínimo para pagamento online é de R$ 1,00.");
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      // Tokenize via Secure Fields
      const tokenResult = await mpInstanceRef.current.fields.createCardToken({
        cardholderName: cardHolderName,
        identificationType: "CPF",
        identificationNumber: cardHolderCpf.replace(/\D/g, ""),
      });

      if (!tokenResult?.id) {
        throw new Error("Erro ao tokenizar cartão. Verifique os dados e tente novamente.");
      }

      // Send tokenized data to backend
      const { data, error } = await supabase.functions.invoke("mercadopago-charge", {
        body: {
          restaurant_id: restaurantId,
          order_id: orderId,
          amount,
          billing_type: "CREDIT_CARD",
          customer_name: customerName,
          customer_cpf: customerCPF,
          customer_email: customerEmail || cardHolderEmail,
          customer_phone: customerPhone || cardHolderPhone,
          card_token: tokenResult.id,
          payment_method_id: tokenResult.payment_method_id || "visa",
          installments: 1,
          items: cartItems,
        },
      });

      if (error) throw error;

      if (data?.error) {
        setErrorMessage(data.error);
        toast.error(data.error);
        return;
      }

      if (data?.confirmed) {
        setOnlinePaymentId(data.online_payment_id);
        setPaymentStatus("confirmed");
        toast.success("Pagamento aprovado! ✅");
        setTimeout(() => onConfirm(data.online_payment_id), 1500);
      } else {
        setErrorMessage("Pagamento não aprovado. Verifique os dados do cartão e tente novamente.");
        toast.error("Pagamento não aprovado");
      }
    } catch (error: any) {
      console.error("[OnlinePayment] Credit card error:", error);
      setErrorMessage(error.message || "Erro ao processar pagamento");
      toast.error("Erro ao processar pagamento");
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ─── CONFIRMED STATE ───
  if (paymentStatus === "confirmed") {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-bold text-green-600">Pagamento Confirmado!</h2>
        <p className="text-muted-foreground text-center">
          Seu pagamento foi aprovado com sucesso. Finalizando pedido...
        </p>
      </div>
    );
  }

  // ─── LOADING STATE ───
  if (paymentStatus === "loading") {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {method === "pix" ? "Gerando QR Code Pix..." : "Processando pagamento..."}
        </p>
      </div>
    );
  }

  // ─── PIX MODE ───
  if (method === "pix") {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold flex items-center justify-center gap-2">
            <Smartphone className="h-5 w-5" />
            Pague via Pix
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Escaneie o QR Code ou copie o código para pagar</p>
        </div>

        {/* Amount */}
        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color: primaryColor }}>
            R$ {amount.toFixed(2).replace(".", ",")}
          </p>
        </div>

        {/* Error state */}
        {paymentStatus === "error" && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-sm text-destructive">{errorMessage}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={createPixCharge}>
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code */}
        {paymentStatus === "waiting" && pixQrCodeBase64 && (
          <>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg border">
                <img src={`data:image/png;base64,${pixQrCodeBase64}`} alt="QR Code Pix" className="w-56 h-56" />
              </div>
            </div>

            {/* Copy code */}
            {pixQrCode && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Código Pix (Copia e Cola)</Label>
                <div className="flex gap-2">
                  <Input value={pixQrCode} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={handleCopyPixCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expira em: {formatTime(timeLeft)}</span>
            </div>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Aguardando pagamento...</span>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={onBack}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // ─── CREDIT CARD MODE ───
  return (
    <div className="p-4 space-y-4">
      <style>{`
        #mp-card-number iframe,
        #mp-expiration-date iframe,
        #mp-security-code iframe {
          height: 100% !important;
          width: 100% !important;
          border: none !important;
          outline: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      <div className="text-center">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamento com Cartão
        </h2>
        <p className="text-3xl font-bold mt-2" style={{ color: primaryColor }}>
          R$ {amount.toFixed(2).replace(".", ",")}
        </p>
      </div>

      {errorMessage && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Card data */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados do Cartão</h3>

        <div className="space-y-1 relative">
          <Label className="w-fit pointer-events-none block z-40 relative">Número do Cartão *</Label>
          <div
            id="mp-card-number"
            className="h-[48px] w-full border border-input rounded-md bg-background relative overflow-hidden cursor-text flex items-center"
          ></div>
        </div>

        <div className="space-y-1 relative">
          <Label className="w-fit pointer-events-none block z-40 relative">Nome Impresso no Cartão *</Label>
          <Input
            value={cardHolderName}
            onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
            placeholder="NOME COMO NO CARTÃO"
            className="h-[48px] relative z-30"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 relative">
            <Label className="w-fit pointer-events-none block z-40 relative">Validade *</Label>
            <div
              id="mp-expiration-date"
              className="h-[48px] w-full border border-input rounded-md bg-background relative overflow-hidden cursor-text flex items-center"
            ></div>
          </div>
          <div className="space-y-1 relative">
            <Label className="w-fit pointer-events-none block z-40 relative">CVV *</Label>
            <div
              id="mp-security-code"
              className="h-[48px] w-full border border-input rounded-md bg-background relative overflow-hidden cursor-text flex items-center"
            ></div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Holder info */}
      <div className="space-y-3 relative z-20">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados do Titular</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>CPF do Titular *</Label>
            <Input
              value={cardHolderCpf}
              onChange={(e) => setCardHolderCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="relative z-30"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              value={cardHolderEmail}
              onChange={(e) => setCardHolderEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="relative z-30"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={cardHolderPhone}
            onChange={(e) => setCardHolderPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="relative z-30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>CEP *</Label>
            <Input
              value={cardHolderPostalCode}
              onChange={(e) => setCardHolderPostalCode(e.target.value)}
              placeholder="00000-000"
              className="relative z-30"
            />
          </div>
          <div className="space-y-2">
            <Label>Nº Endereço *</Label>
            <Input
              value={cardHolderAddressNumber}
              onChange={(e) => setCardHolderAddressNumber(e.target.value)}
              placeholder="123"
              className="relative z-30"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={processing}>
          Voltar
        </Button>
        <Button
          className="flex-1"
          onClick={handleCreditCardPayment}
          disabled={processing}
          style={primaryColor ? { backgroundColor: primaryColor, color: "white" } : undefined}
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            `Pagar R$ ${amount.toFixed(2).replace(".", ",")}`
          )}
        </Button>
      </div>
    </div>
  );
};
