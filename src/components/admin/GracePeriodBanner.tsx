import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface GracePeriodBannerProps {
  restaurantId: string;
  onRegularize: () => void;
}

export function GracePeriodBanner({ restaurantId, onRegularize }: GracePeriodBannerProps) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [downgraded, setDowngraded] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;

    const check = async () => {
      const { data } = await supabase
        .from("restaurant_subscriptions")
        .select("status, in_grace_period, grace_period_ends_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setDaysLeft(null);
        setDowngraded(false);
        return;
      }

      if ((data as any).status === "downgraded_free") {
        setDowngraded(true);
        setDaysLeft(null);
        return;
      }

      if ((data as any).in_grace_period && (data as any).grace_period_ends_at) {
        const end = new Date((data as any).grace_period_ends_at).getTime();
        const left = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
        setDaysLeft(Math.max(0, left));
        setDowngraded(false);
      } else {
        setDaysLeft(null);
        setDowngraded(false);
      }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000); // re-check a cada 5min

    // Realtime — atualiza quando webhook altera a assinatura
    const channel = supabase
      .channel(`grace-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "restaurant_subscriptions",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => check()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  if (daysLeft === null && !downgraded) return null;

  return (
    <div className="w-full bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md relative z-50">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          {downgraded
            ? "Seu plano foi revertido para o gratuito por falta de pagamento. Regularize para reativar os módulos."
            : daysLeft && daysLeft > 0
            ? `Pagamento pendente — em ${daysLeft} dia${daysLeft > 1 ? "s" : ""} seu plano voltará para o gratuito se não regularizado.`
            : "Período de regularização encerrado. Atualize seu pagamento agora."}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="text-white border-white hover:bg-white/20 hover:text-white flex-shrink-0"
        onClick={onRegularize}
      >
        Regularizar agora
      </Button>
    </div>
  );
}
