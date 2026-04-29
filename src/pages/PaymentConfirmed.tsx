import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 10000;

export default function PaymentConfirmed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get("plan");
  const slugParam = searchParams.get("slug");

  const [status, setStatus] = useState<"polling" | "success" | "timeout">("polling");
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(slugParam);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const tryGetSlugFromSession = (): string | null => {
      if (slugParam) return slugParam;
      try {
        const stored = localStorage.getItem("restaurant_slug");
        if (stored) return stored;
      } catch {}
      return null;
    };

    const poll = async () => {
      const slug = tryGetSlugFromSession();
      if (slug && !resolvedSlug) setResolvedSlug(slug);

      // Try matching by slug first
      let restaurantId: string | null = null;
      if (slug) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (rest) restaurantId = rest.id;
      }

      if (restaurantId) {
        const { data: subs } = await supabase
          .from("restaurant_subscriptions" as any)
          .select("status")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(1);

        const sub = (subs as any[] | null)?.[0];
        if (sub?.status === "active" && !cancelled) {
          setStatus("success");
          toast.success("Plano ativado com sucesso!");
          setTimeout(() => navigate(`/${slug}/admin`), 1500);
          return true;
        }
      }
      return false;
    };

    const interval = setInterval(async () => {
      if (cancelled) return;
      const done = await poll();
      if (done) {
        clearInterval(interval);
        return;
      }
      if (Date.now() - startedAt >= MAX_POLL_MS) {
        clearInterval(interval);
        if (!cancelled) setStatus("timeout");
      }
    }, POLL_INTERVAL_MS);

    // First immediate try
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 text-center space-y-4">
          {status === "polling" && (
            <>
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <h1 className="text-xl font-semibold">Pagamento confirmado!</h1>
              <p className="text-muted-foreground">Ativando seu plano{planSlug ? ` ${planSlug}` : ""}...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <h1 className="text-xl font-semibold">Plano ativado!</h1>
              <p className="text-muted-foreground">Redirecionando para o painel...</p>
            </>
          )}
          {status === "timeout" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <h1 className="text-xl font-semibold">Pagamento recebido!</h1>
              <p className="text-muted-foreground">
                Seu plano será ativado em instantes. Se não aparecer em 5 minutos,
                entre em contato com o suporte.
              </p>
              <Button
                className="w-full"
                onClick={() => navigate(resolvedSlug ? `/${resolvedSlug}/admin` : "/login")}
              >
                Ir para o login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
