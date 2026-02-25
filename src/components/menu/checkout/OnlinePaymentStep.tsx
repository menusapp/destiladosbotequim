import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, CheckCircle2, AlertCircle, CreditCard, Smartphone, Clock, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CartItemForPayment {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface SavedCard {
  id: string;
  last_four_digits: string;
  payment_method_id: string;
  first_six_digits: string | null;
  expiration_month: number | null;
  expiration_year: number | null;
  card_id: string;
  mp_customer_id: string;
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

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  amex: "Amex",
  elo: "Elo",
  hipercard: "Hipercard",
};

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

  // Credit card state (only non-sensitive fields)
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardHolderCpf, setCardHolderCpf] = useState(customerCPF);
  const [cardHolderEmail, setCardHolderEmail] = useState(customerEmail || "");
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);

  // Secure Fields refs
  const mpInstanceRef = useRef<any>(null);
  const secureFieldsReadyRef = useRef(false);
  const [secureFieldsLoaded, setSecureFieldsLoaded] = useState(false);
  const [detectedBrand, setDetectedBrand] = useState<string>("");

  // Saved cards state
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string>(""); // "new" or card id
  const [loadingSavedCards, setLoadingSavedCards] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Timer for PIX expiration
  const [timeLeft, setTimeLeft] = useState(30 * 60);

  const cpfIsPreFilled = !!customerCPF;
  const emailIsPreFilled = !!customerEmail;

  // ─── Load saved cards ───
  const loadSavedCards = useCallback(async () => {
    if (!customerCPF || !restaurantId) return;
    setLoadingSavedCards(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-cards", {
        body: { action: "list", restaurant_id: restaurantId, customer_cpf: customerCPF },
      });
      if (!error && data?.cards) {
        setSavedCards(data.cards);
        if (data.cards.length > 0) {
          setSelectedSavedCard(data.cards[0].id);
        } else {
          setSelectedSavedCard("new");
        }
      } else {
        setSelectedSavedCard("new");
      }
    } catch {
      setSelectedSavedCard("new");
    } finally {
      setLoadingSavedCards(false);
    }
  }, [customerCPF, restaurantId]);

  useEffect(() => {
    if (method === "pix") {
      createPixCharge();
    } else {
      setPaymentStatus("waiting");
      loadSavedCards();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ─── Initialize Secure Fields when "new card" is selected ───
  const secureFieldInstancesRef = useRef<any[]>([]);

  useEffect(() => {
    if (method !== "credit_card" || selectedSavedCard !== "new") return;
    
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const waitForContainers = (): Promise<boolean> => {
      return new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          if (document.getElementById("mp-card-number")) {
            resolve(true);
          } else if (attempts < 20) {
            retryTimer = setTimeout(check, 150);
          } else {
            console.error("[OnlinePayment] Containers not found after retries");
            resolve(false);
          }
        };
        check();
      });
    };

    const initSecureFields = async () => {
      try {
        const { data: config } = await supabase
          .from("online_payment_config")
          .select("mp_public_key")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (cancelled || !config?.mp_public_key) return;

        const containersReady = await waitForContainers();
        if (cancelled || !containersReady) return;

        // Unmount previous instances before re-mounting
        secureFieldInstancesRef.current.forEach((f) => { try { f.unmount(); } catch {} });
        secureFieldInstancesRef.current = [];

        const mp = new (window as any).MercadoPago(config.mp_public_key);
        mpInstanceRef.current = mp;

        const style = {
          height: "100%",
          width: "100%",
          fontSize: "16px",
          fontFamily: "inherit",
          color: "#333",
          "::placeholder": { color: "#999" },
        };

        const cardNumber = mp.fields.create("cardNumber", { placeholder: "0000 0000 0000 0000", style });
        const expirationDate = mp.fields.create("expirationDate", { placeholder: "MM/AA", style });
        const securityCode = mp.fields.create("securityCode", { placeholder: "CVV", style });

        secureFieldInstancesRef.current = [cardNumber, expirationDate, securityCode];

        cardNumber.mount("#mp-card-number");
        expirationDate.mount("#mp-expiration-date");
        securityCode.mount("#mp-security-code");

        // Listen for BIN changes to detect brand
        cardNumber.on("binChange", (data: any) => {
          if (data?.bin) {
            const firstDigit = data.bin[0];
            if (firstDigit === "4") setDetectedBrand("visa");
            else if (firstDigit === "5") setDetectedBrand("master");
            else if (firstDigit === "3") setDetectedBrand("amex");
            else if (firstDigit === "6") setDetectedBrand("elo");
            else setDetectedBrand("");
          } else {
            setDetectedBrand("");
          }
        });

        secureFieldsReadyRef.current = true;
        setSecureFieldsLoaded(true);
      } catch (err) {
        console.error("[OnlinePayment] Secure Fields init error:", err);
      }
    };

    initSecureFields();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      secureFieldInstancesRef.current.forEach((f) => { try { f.unmount(); } catch {} });
      secureFieldInstancesRef.current = [];
      secureFieldsReadyRef.current = false;
      setSecureFieldsLoaded(false);
      mpInstanceRef.current = null;
    };
  }, [method, selectedSavedCard, restaurantId]);

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

  // ─── PIX ───
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
          restaurant_id: restaurantId, order_id: orderId, amount, billing_type: "PIX",
          customer_name: customerName, customer_cpf: customerCPF,
          customer_email: customerEmail, customer_phone: customerPhone, items: cartItems,
        },
      });
      if (error) throw error;
      if (data?.error) { setPaymentStatus("error"); setErrorMessage(data.error); return; }
      setPixQrCode(data.pix_qr_code);
      setPixQrCodeBase64(data.pix_qr_code_base64);
      setPixExpiration(data.pix_expiration);
      setOnlinePaymentId(data.online_payment_id);
      setPaymentStatus("waiting");
      if (data.online_payment_id) startPolling(data.online_payment_id);
    } catch (error: any) {
      console.error("[OnlinePayment] Error creating PIX charge:", error);
      setPaymentStatus("error");
      setErrorMessage(error.message || "Erro ao gerar QR Code Pix");
    }
  };

  const startPolling = (paymentId: string) => {
    pollingRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from("online_payments").select("status").eq("id", paymentId).maybeSingle();
      if (!error && data?.status === "confirmed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPaymentStatus("confirmed");
        toast.success("Pagamento confirmado! ✅");
        setTimeout(() => onConfirm(paymentId), 1500);
      }
    }, 5000);
  };

  const handleCopyPixCode = () => {
    if (pixQrCode) { navigator.clipboard.writeText(pixQrCode); toast.success("Código Pix copiado!"); }
  };

  // ─── CREDIT CARD PAYMENT ───
  const handleCreditCardPayment = async () => {
    if (amount < 1) { toast.error("O valor mínimo para pagamento online é de R$ 1,00."); return; }

    // Paying with saved card
    if (selectedSavedCard !== "new") {
      setProcessing(true);
      setErrorMessage("");
      try {
        const card = savedCards.find(c => c.id === selectedSavedCard);
        if (!card) throw new Error("Cartão não encontrado");

        const { data, error } = await supabase.functions.invoke("mercadopago-charge", {
          body: {
            restaurant_id: restaurantId, order_id: orderId, amount, billing_type: "CREDIT_CARD",
            customer_name: customerName, customer_cpf: customerCPF,
            customer_email: customerEmail || cardHolderEmail,
            customer_phone: customerPhone, installments: 1, items: cartItems,
            saved_card_id: card.id,
          },
        });
        if (error) throw error;
        if (data?.error) { setErrorMessage(data.error); toast.error(data.error); return; }
        if (data?.confirmed) {
          setPaymentStatus("confirmed");
          toast.success("Pagamento aprovado! ✅");
          setTimeout(() => onConfirm(data.online_payment_id), 1500);
        } else {
          setErrorMessage("Pagamento não aprovado. Tente outro cartão.");
          toast.error("Pagamento não aprovado");
        }
      } catch (error: any) {
        console.error("[OnlinePayment] Saved card error:", error);
        setErrorMessage(error.message || "Erro ao processar pagamento");
        toast.error("Erro ao processar pagamento");
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Paying with NEW card via Secure Fields
    if (!cardHolderName) { toast.error("Preencha o nome no cartão"); return; }
    if (!cardHolderCpf) { toast.error("Preencha o CPF do titular"); return; }
    if (!secureFieldsReadyRef.current || !mpInstanceRef.current) {
      toast.error("Campos do cartão ainda carregando. Aguarde.");
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      const mp = mpInstanceRef.current;

      // Tokenize via Secure Fields
      const cardTokenResult = await mp.fields.createCardToken({
        cardholderName: cardHolderName,
        identificationType: "CPF",
        identificationNumber: cardHolderCpf.replace(/\D/g, ""),
      });

      if (!cardTokenResult?.id) {
        throw new Error("Erro ao tokenizar cartão. Verifique os dados e tente novamente.");
      }

      // Determine payment method from detected brand or fallback
      const paymentMethodId = detectedBrand || "visa";

      const { data, error } = await supabase.functions.invoke("mercadopago-charge", {
        body: {
          restaurant_id: restaurantId, order_id: orderId, amount, billing_type: "CREDIT_CARD",
          customer_name: customerName, customer_cpf: customerCPF,
          customer_email: customerEmail || cardHolderEmail,
          customer_phone: customerPhone,
          card_token: cardTokenResult.id, payment_method_id: paymentMethodId,
          installments: 1, items: cartItems,
          save_card: saveCard,
        },
      });

      if (error) throw error;
      if (data?.error) { setErrorMessage(data.error); toast.error(data.error); return; }
      if (data?.confirmed) {
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

  // ─── DELETE SAVED CARD ───
  const handleDeleteCard = async (cardRecordId: string) => {
    setDeletingCardId(cardRecordId);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-cards", {
        body: { action: "delete", restaurant_id: restaurantId, card_record_id: cardRecordId },
      });
      if (!error && data?.success) {
        setSavedCards(prev => prev.filter(c => c.id !== cardRecordId));
        if (selectedSavedCard === cardRecordId) {
          const remaining = savedCards.filter(c => c.id !== cardRecordId);
          setSelectedSavedCard(remaining.length > 0 ? remaining[0].id : "new");
        }
        toast.success("Cartão removido");
      } else {
        toast.error("Erro ao remover cartão");
      }
    } catch {
      toast.error("Erro ao remover cartão");
    } finally {
      setDeletingCardId(null);
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
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie o QR Code ou copie o código para pagar
          </p>
        </div>

        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color: primaryColor }}>
            R$ {amount.toFixed(2).replace(".", ",")}
          </p>
        </div>

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

        {paymentStatus === "waiting" && pixQrCodeBase64 && (
          <>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg border">
                <img src={`data:image/png;base64,${pixQrCodeBase64}`} alt="QR Code Pix" className="w-56 h-56" />
              </div>
            </div>
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
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expira em: {formatTime(timeLeft)}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Aguardando pagamento...</span>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={onBack}>Voltar</Button>
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

      {/* ─── Saved Cards List ─── */}
      {loadingSavedCards ? (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando cartões...</span>
        </div>
      ) : savedCards.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Seus Cartões Salvos
          </h3>
          <RadioGroup value={selectedSavedCard} onValueChange={setSelectedSavedCard}>
            {savedCards.map((card) => (
              <div key={card.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value={card.id} id={`card-${card.id}`} />
                <label htmlFor={`card-${card.id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {CARD_BRAND_LABELS[card.payment_method_id] || card.payment_method_id}
                  </span>
                  <span className="text-sm text-muted-foreground">•••• {card.last_four_digits}</span>
                  {card.expiration_month && card.expiration_year && (
                    <span className="text-xs text-muted-foreground">
                      {String(card.expiration_month).padStart(2, "0")}/{String(card.expiration_year).slice(-2)}
                    </span>
                  )}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.preventDefault(); handleDeleteCard(card.id); }}
                  disabled={deletingCardId === card.id}
                >
                  {deletingCardId === card.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="new" id="card-new" />
              <label htmlFor="card-new" className="flex-1 cursor-pointer flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" />
                Usar novo cartão
              </label>
            </div>
          </RadioGroup>
        </div>
      ) : null}

      {/* ─── New Card Form (Secure Fields) ─── */}
      {selectedSavedCard === "new" && (
        <>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Dados do Cartão
            </h3>

            {/* Secure Field: Card Number */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Número do Cartão *
                {detectedBrand && (
                  <Badge variant="secondary" className="text-xs">
                    {CARD_BRAND_LABELS[detectedBrand] || detectedBrand}
                  </Badge>
                )}
              </Label>
              <div
                id="mp-card-number"
                className="h-10 w-full min-h-[40px] rounded-md border border-input bg-background overflow-hidden [&>iframe]{h-full w-full}"
              />
            </div>

            {/* Name on card (normal input) */}
            <div className="space-y-2">
              <Label>Nome no Cartão *</Label>
              <Input
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                placeholder="NOME COMO NO CARTÃO"
              />
            </div>

            {/* Secure Fields: Expiry + CVV */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Validade *</Label>
                <div
                  id="mp-expiration-date"
                  className="h-10 w-full min-h-[40px] rounded-md border border-input bg-background overflow-hidden"
                />
              </div>
              <div className="space-y-2">
                <Label>CVV *</Label>
                <div
                  id="mp-security-code"
                  className="h-10 w-full min-h-[40px] rounded-md border border-input bg-background overflow-hidden"
                />
              </div>
            </div>

            {!secureFieldsLoaded && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando campos seguros...
              </div>
            )}
          </div>

          <Separator />

          {/* Holder info (CPF + Email only) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Dados do Titular
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  CPF do Titular *
                  {cpfIsPreFilled && <Badge variant="secondary" className="text-[10px]">Auto</Badge>}
                </Label>
                {cpfIsPreFilled ? (
                  <Input value={cardHolderCpf} readOnly className="bg-muted" />
                ) : (
                  <Input
                    value={cardHolderCpf}
                    onChange={(e) => setCardHolderCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  E-mail
                  {emailIsPreFilled && <Badge variant="secondary" className="text-[10px]">Auto</Badge>}
                </Label>
                {emailIsPreFilled ? (
                  <Input value={cardHolderEmail} readOnly className="bg-muted" />
                ) : (
                  <Input
                    value={cardHolderEmail}
                    onChange={(e) => setCardHolderEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Save card checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="save-card"
              checked={saveCard}
              onCheckedChange={(checked) => setSaveCard(checked === true)}
            />
            <label htmlFor="save-card" className="text-sm cursor-pointer">
              Salvar cartão para próximas compras
            </label>
          </div>
        </>
      )}

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
