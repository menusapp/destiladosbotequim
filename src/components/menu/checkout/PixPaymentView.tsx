import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, CheckCircle2, Loader2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { paymentService } from "@/services/paymentService";

interface PixPaymentViewProps {
  paymentId: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
  pixExpiration: string;
  amount: number;
  onPaymentConfirmed: () => void;
  onCancel: () => void;
  primaryColor?: string;
}

export const PixPaymentView = ({
  paymentId,
  pixQrCode,
  pixQrCodeBase64,
  pixExpiration,
  amount,
  onPaymentConfirmed,
  onCancel,
  primaryColor,
}: PixPaymentViewProps) => {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Calculate time left
  useEffect(() => {
    const expiration = new Date(pixExpiration).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiration - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        setStatus("rejected");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pixExpiration]);

  // Poll for payment status
  useEffect(() => {
    if (status !== "pending") return;

    const checkStatus = async () => {
      const result = await paymentService.getPaymentStatus(paymentId);
      if (result.status === "approved") {
        setStatus("approved");
        setTimeout(onPaymentConfirmed, 1500);
      } else if (result.status === "rejected" || result.status === "cancelled") {
        setStatus("rejected");
      }
    };

    const interval = setInterval(checkStatus, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [paymentId, status, onPaymentConfirmed]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixQrCode);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar código");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (status === "approved") {
    return (
      <Card className="border-green-500/50 bg-green-500/10">
        <CardContent className="p-6 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h3 className="text-xl font-bold text-green-700">Pagamento Confirmado!</h3>
          <p className="text-muted-foreground">Seu pedido está sendo processado...</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "rejected" || timeLeft === 0) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6 text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <h3 className="text-xl font-bold text-destructive">Pix Expirado</h3>
          <p className="text-muted-foreground">O tempo para pagamento expirou.</p>
          <Button onClick={onCancel} variant="outline">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Timer */}
        <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Expira em: {formatTime(timeLeft)}</span>
        </div>

        {/* Amount */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Valor a pagar</p>
          <p className="text-2xl font-bold" style={primaryColor ? { color: primaryColor } : undefined}>
            R$ {amount.toFixed(2).replace(".", ",")}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center p-4 bg-white rounded-lg">
          {pixQrCodeBase64 ? (
            <img src={pixQrCodeBase64} alt="QR Code Pix" className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
              <QrCode className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Copy button */}
        <Button
          onClick={handleCopy}
          variant="outline"
          className="w-full"
          disabled={copied}
        >
          {copied ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copiar código Pix
            </>
          )}
        </Button>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Aguardando pagamento...</span>
        </div>

        {/* Cancel button */}
        <Button variant="ghost" onClick={onCancel} className="w-full text-muted-foreground">
          Cancelar
        </Button>
      </CardContent>
    </Card>
  );
};
