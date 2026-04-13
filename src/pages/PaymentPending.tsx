import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, CreditCard } from "lucide-react";

const PaymentPending = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [activated, setActivated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const checkSubscription = async () => {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!restaurant) return;

      const { data: sub } = await (supabase.from("restaurant_subscriptions" as any) as any)
        .select("status")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub?.status === "active") {
        setActivated(true);
        setTimeout(() => navigate(`/${slug}/admin`), 2000);
      }
      setChecking(false);
    };

    checkSubscription();
    const interval = setInterval(checkSubscription, 5000);
    return () => clearInterval(interval);
  }, [slug, navigate]);

  if (activated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
            <p className="text-muted-foreground">Redirecionando para o painel...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center space-y-4">
          <CreditCard className="h-16 w-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Processando seu pagamento...</h2>
          <p className="text-muted-foreground">
            Estamos aguardando a confirmação do Mercado Pago.
            Esta página será atualizada automaticamente.
          </p>
          {checking && <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />}
          <Button variant="outline" onClick={() => navigate(`/${slug}/admin`)}>
            Ir para o painel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentPending;
