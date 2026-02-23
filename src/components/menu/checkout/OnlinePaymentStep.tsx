import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Copy, CheckCircle2, AlertCircle, CreditCard, Smartphone, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [cardHolderCpf, setCardHolderCpf] = useState(customerCPF);
  const [cardHolderEmail, setCardHolderEmail] = useState(customerEmail || "");
  const [cardHolderPhone, setCardHolderPhone] = useState(customerPhone);
  const [cardHolderPostalCode, setCardHolderPostalCode] = useState("");
  const [cardHolderAddressNumber, setCardHolderAddressNumber] = useState("");
  const [processing, setProcessing] = useState(false);

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

  // Timer countdown for PIX
  useEffect(() => {
    if (method !== "pix" || paymentStatus !== "waiting") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentStatus("error");
          setErrorMessage("QR Code Pix expirado. Tente novamente.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [method, paymentStatus]);

  const createPixCharge = async () => {
    try {
      if (amount < 5) {
        setPaymentStatus("error");
        setErrorMessage("O valor mínimo para pagamento online é de R$ 5,00.");
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
      const { data, error } = await supabase
        .from("online_payments")
        .select("status")
        .eq("id", paymentId)
        .maybeSingle();

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
    if (!cardNumber || !cardHolderName || !cardExpiryMonth || !cardExpiryYear || !cardCcv) {
      toast.error("Preencha todos os dados do cartão");
      return;
    }

    if (!cardHolderCpf || !cardHolderPostalCode || !cardHolderAddressNumber) {
      toast.error("Preencha CPF, CEP e número do endereço do titular");
      return;
    }

    if (amount < 5) {
      toast.error("O valor mínimo para pagamento online é de R$ 5,00.");
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-charge", {
        body: {
          restaurant_id: restaurantId,
          order_id: orderId,
          amount,
          billing_type: "CREDIT_CARD",
          customer_name: customerName,
          customer_cpf: customerCPF,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          card_holder_name: cardHolderName,
          card_number: cardNumber,
          card_expiry_month: cardExpiryMonth,
          card_expiry_year: cardExpiryYear,
          card_ccv: cardCcv,
          card_holder_cpf: cardHolderCpf,
          card_holder_email: cardHolderEmail,
          card_holder_phone: cardHolderPhone,
          card_holder_postal_code: cardHolderPostalCode,
          card_holder_address_number: cardHolderAddressNumber,
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

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
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
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie o QR Code ou copie o código para pagar
          </p>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={createPixCharge}
                >
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
                <img
                  src={`data:image/png;base64,${pixQrCodeBase64}`}
                  alt="QR Code Pix"
                  className="w-56 h-56"
                />
              </div>
            </div>

            {/* Copy code */}
            {pixQrCode && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Código Pix (Copia e Cola)</Label>
                <div className="flex gap-2">
                  <Input
                    value={pixQrCode}
                    readOnly
                    className="text-xs font-mono"
                  />
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
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Dados do Cartão
        </h3>
        <div className="space-y-2">
          <Label>Número do Cartão *</Label>
          <Input
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="0000 0000 0000 0000"
            maxLength={19}
          />
        </div>
        <div className="space-y-2">
          <Label>Nome no Cartão *</Label>
          <Input
            value={cardHolderName}
            onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
            placeholder="NOME COMO NO CARTÃO"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label>Mês *</Label>
            <Input
              value={cardExpiryMonth}
              onChange={(e) => setCardExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="MM"
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Ano *</Label>
            <Input
              value={cardExpiryYear}
              onChange={(e) => setCardExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="AAAA"
              maxLength={4}
            />
          </div>
          <div className="space-y-2">
            <Label>CVV *</Label>
            <Input
              type="password"
              value={cardCcv}
              onChange={(e) => setCardCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="***"
              maxLength={4}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Holder info */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Dados do Titular
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>CPF do Titular *</Label>
            <Input
              value={cardHolderCpf}
              onChange={(e) => setCardHolderCpf(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              value={cardHolderEmail}
              onChange={(e) => setCardHolderEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={cardHolderPhone}
            onChange={(e) => setCardHolderPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>CEP *</Label>
            <Input
              value={cardHolderPostalCode}
              onChange={(e) => setCardHolderPostalCode(e.target.value)}
              placeholder="00000-000"
            />
          </div>
          <div className="space-y-2">
            <Label>Nº Endereço *</Label>
            <Input
              value={cardHolderAddressNumber}
              onChange={(e) => setCardHolderAddressNumber(e.target.value)}
              placeholder="123"
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
