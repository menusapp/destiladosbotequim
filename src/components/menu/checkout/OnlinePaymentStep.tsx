import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, CreditCard, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CardPaymentForm } from "./CardPaymentForm";
import { PixPaymentView } from "./PixPaymentView";
import { paymentService, CreatePaymentRequest } from "@/services/paymentService";

interface OnlinePaymentStepProps {
  restaurantId: string;
  amount: number;
  customer: {
    name: string;
    email?: string;
    cpf: string;
    phone?: string;
  };
  onBack: () => void;
  onPaymentComplete: (paymentId: string, method: "pix" | "credit_card") => void;
  primaryColor?: string;
  publicKey?: string;
  acceptPix?: boolean;
  acceptCard?: boolean;
}

type PaymentMethod = "select" | "pix" | "credit_card";

export const OnlinePaymentStep = ({
  restaurantId,
  amount,
  customer,
  onBack,
  onPaymentComplete,
  primaryColor,
  publicKey,
  acceptPix = true,
  acceptCard = true,
}: OnlinePaymentStepProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("select");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{
    paymentId: string;
    pixQrCode: string;
    pixQrCodeBase64: string;
    pixExpiration: string;
  } | null>(null);

  const handleSelectPix = async () => {
    setLoading(true);
    try {
      const request: CreatePaymentRequest = {
        restaurantId,
        amount,
        description: "Pedido Delivery",
        paymentMethod: "pix",
        customer,
      };

      const result = await paymentService.createPayment(request);

      if (!result.success || !result.paymentId) {
        toast.error(result.error || "Erro ao gerar Pix");
        return;
      }

      setPixData({
        paymentId: result.paymentId,
        pixQrCode: result.pixQrCode || "",
        pixQrCodeBase64: result.pixQrCodeBase64 || "",
        pixExpiration: result.pixExpiration || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      setSelectedMethod("pix");
    } catch (err) {
      console.error("Erro ao criar Pix:", err);
      toast.error("Erro ao gerar pagamento Pix");
    } finally {
      setLoading(false);
    }
  };

  const handleCardPayment = async (data: {
    cardToken: string;
    paymentMethodId: string;
    installments: number;
  }) => {
    setLoading(true);
    try {
      const request: CreatePaymentRequest = {
        restaurantId,
        amount,
        description: "Pedido Delivery",
        paymentMethod: "credit_card",
        customer,
        cardToken: data.cardToken,
        installments: data.installments,
        paymentMethodId: data.paymentMethodId,
      };

      const result = await paymentService.createPayment(request);

      if (!result.success) {
        toast.error(result.error || "Erro ao processar pagamento");
        return;
      }

      if (result.status === "approved") {
        toast.success("Pagamento aprovado!");
        onPaymentComplete(result.paymentId!, "credit_card");
      } else if (result.status === "pending") {
        toast.info("Pagamento em análise");
        onPaymentComplete(result.paymentId!, "credit_card");
      } else {
        toast.error("Pagamento recusado. Tente outro cartão.");
      }
    } catch (err) {
      console.error("Erro ao processar cartão:", err);
      toast.error("Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handlePixConfirmed = () => {
    if (pixData) {
      onPaymentComplete(pixData.paymentId, "pix");
    }
  };

  // Show Pix view
  if (selectedMethod === "pix" && pixData) {
    return (
      <div className="p-4">
        <PixPaymentView
          paymentId={pixData.paymentId}
          pixQrCode={pixData.pixQrCode}
          pixQrCodeBase64={pixData.pixQrCodeBase64}
          pixExpiration={pixData.pixExpiration}
          amount={amount}
          onPaymentConfirmed={handlePixConfirmed}
          onCancel={() => {
            setSelectedMethod("select");
            setPixData(null);
          }}
          primaryColor={primaryColor}
        />
      </div>
    );
  }

  // Show Card form
  if (selectedMethod === "credit_card") {
    return (
      <div className="p-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedMethod("select")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <CardPaymentForm
          publicKey={publicKey || ""}
          amount={amount}
          customerCPF={customer.cpf}
          onSubmit={handleCardPayment}
          onCancel={() => setSelectedMethod("select")}
          isProcessing={loading}
          primaryColor={primaryColor}
        />
      </div>
    );
  }

  // Method selection
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold">Pagamento Online</h2>
      </div>

      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">Total a pagar</p>
        <p className="text-2xl font-bold" style={primaryColor ? { color: primaryColor } : undefined}>
          R$ {amount.toFixed(2).replace(".", ",")}
        </p>
      </div>

      <div className="space-y-3">
        {acceptPix && (
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={!loading ? handleSelectPix : undefined}
          >
            <CardContent className="p-4 flex items-center gap-4">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: primaryColor ? `${primaryColor}20` : "hsl(var(--primary) / 0.1)" }}
                >
                  <Smartphone className="h-6 w-6" style={primaryColor ? { color: primaryColor } : undefined} />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold">Pix</h3>
                <p className="text-sm text-muted-foreground">Pagamento instantâneo com QR Code</p>
              </div>
            </CardContent>
          </Card>
        )}

        {acceptCard && publicKey && (
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedMethod("credit_card")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: primaryColor ? `${primaryColor}20` : "hsl(var(--primary) / 0.1)" }}
              >
                <CreditCard className="h-6 w-6" style={primaryColor ? { color: primaryColor } : undefined} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Cartão de Crédito</h3>
                <p className="text-sm text-muted-foreground">Pague em até 12x</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
