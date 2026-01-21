import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Lock, Loader2 } from "lucide-react";
import { useMercadoPago, Installment, PaymentMethodInfo } from "@/hooks/useMercadoPago";

interface CardPaymentFormProps {
  publicKey: string;
  amount: number;
  customerCPF: string;
  onSubmit: (data: {
    cardToken: string;
    paymentMethodId: string;
    installments: number;
  }) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  primaryColor?: string;
}

export const CardPaymentForm = ({
  publicKey,
  amount,
  customerCPF,
  onSubmit,
  onCancel,
  isProcessing = false,
  primaryColor,
}: CardPaymentFormProps) => {
  const { isReady, error: sdkError, createCardToken, getPaymentMethods, getInstallments } = useMercadoPago(publicKey);

  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [installments, setInstallments] = useState(1);
  const [availableInstallments, setAvailableInstallments] = useState<Installment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ") : cleaned;
  };

  // Format expiration date
  const formatExpirationDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  // Detect card brand and get installments
  useEffect(() => {
    const bin = cardNumber.replace(/\s/g, "").slice(0, 6);
    if (bin.length >= 6 && isReady) {
      getPaymentMethods(bin).then((method) => {
        setPaymentMethod(method);
        if (method) {
          getInstallments(amount, bin, method.id).then(setAvailableInstallments);
        }
      });
    } else {
      setPaymentMethod(null);
      setAvailableInstallments([]);
    }
  }, [cardNumber, amount, isReady, getPaymentMethods, getInstallments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate fields
    if (!cardNumber || !cardholderName || !expirationDate || !securityCode) {
      setError("Preencha todos os campos do cartão");
      setLoading(false);
      return;
    }

    const [month, year] = expirationDate.split("/");
    if (!month || !year || month.length !== 2 || year.length !== 2) {
      setError("Data de validade inválida");
      setLoading(false);
      return;
    }

    try {
      const result = await createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardholderName,
        expirationMonth: month,
        expirationYear: `20${year}`,
        securityCode,
        identificationType: "CPF",
        identificationNumber: customerCPF,
      });

      if ("error" in result) {
        setError(result.error);
        setLoading(false);
        return;
      }

      onSubmit({
        cardToken: result.token,
        paymentMethodId: paymentMethod?.id || "visa",
        installments,
      });
    } catch (err: any) {
      setError(err.message || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Carregando formulário de pagamento...</span>
        </CardContent>
      </Card>
    );
  }

  if (sdkError) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">{sdkError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Lock className="h-4 w-4" />
          <span>Pagamento seguro via Mercado Pago</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Número do Cartão</Label>
            <div className="relative">
              <Input
                id="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className="pr-12"
              />
              {paymentMethod ? (
                <img
                  src={paymentMethod.secure_thumbnail}
                  alt={paymentMethod.name}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-auto"
                />
              ) : (
                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Cardholder Name */}
          <div className="space-y-2">
            <Label htmlFor="cardholderName">Nome no Cartão</Label>
            <Input
              id="cardholderName"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
              placeholder="NOME COMO ESTÁ NO CARTÃO"
            />
          </div>

          {/* Expiration and CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expirationDate">Validade</Label>
              <Input
                id="expirationDate"
                value={expirationDate}
                onChange={(e) => setExpirationDate(formatExpirationDate(e.target.value))}
                placeholder="MM/AA"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="securityCode">CVV</Label>
              <Input
                id="securityCode"
                type="password"
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>

          {/* Installments */}
          {availableInstallments.length > 0 && (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select
                value={String(installments)}
                onValueChange={(value) => setInstallments(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione as parcelas" />
                </SelectTrigger>
                <SelectContent>
                  {availableInstallments.map((inst) => (
                    <SelectItem key={inst.installments} value={String(inst.installments)}>
                      {inst.recommended_message}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={loading || isProcessing}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || isProcessing}
              style={primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
            >
              {loading || isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                `Pagar R$ ${amount.toFixed(2).replace(".", ",")}`
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
