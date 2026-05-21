import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  orderId: string | null;
  primaryColor: string;
  onNewOrder: () => void;
}

const AUTO_RESET_SECONDS = 15;

export function KioskConfirmation({ orderId, primaryColor, onNewOrder }: Props) {
  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS);
  const [dailyNumber, setDailyNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!orderId) { setDailyNumber(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("daily_order_number")
        .eq("id", orderId)
        .maybeSingle();
      if (!cancelled && data?.daily_order_number != null) {
        setDailyNumber(Number(data.daily_order_number));
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { onNewOrder(); return AUTO_RESET_SECONDS; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onNewOrder]);

  const orderDisplay = dailyNumber != null
    ? `Pedido ${dailyNumber}`
    : (orderId ? `#${orderId.slice(-6).toUpperCase()}` : "------");

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-8 px-8 text-center">
      <div className="rounded-full p-6" style={{ backgroundColor: `${primaryColor}20` }}>
        <CheckCircle2 className="h-24 w-24" style={{ color: primaryColor }} />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold text-foreground">Pedido Confirmado!</h1>

      <div className="bg-card rounded-2xl border p-8">
        <p className="text-lg text-muted-foreground mb-2">Número do pedido</p>
        <p className="text-5xl font-mono font-bold tracking-widest" style={{ color: primaryColor }}>{orderDisplay}</p>
      </div>

      <p className="text-xl text-muted-foreground max-w-md">
        Aguarde ser chamado. Seu pedido está sendo preparado!
      </p>

      <Button
        onClick={onNewOrder}
        className="h-16 px-12 text-xl font-bold rounded-xl text-white"
        style={{ backgroundColor: primaryColor }}
      >
        Novo Pedido
      </Button>

      <p className="text-muted-foreground">Voltando à tela inicial em {countdown}s</p>
    </div>
  );
}
