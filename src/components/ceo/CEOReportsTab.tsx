import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, TrendingUp, Store } from "lucide-react";
import { format } from "date-fns";

interface PaymentSummary {
  restaurant_id: string;
  restaurant_name: string;
  total_paid: number;
  last_payment: string | null;
}

export function CEOReportsTab() {
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [summaries, setSummaries] = useState<PaymentSummary[]>([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    // Fetch all payments
    const { data: payments } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("status", "paid");

    // Fetch active subscriptions with plan prices
    const { data: subs } = await supabase
      .from("restaurant_subscriptions")
      .select("*, subscription_plans(price)")
      .eq("status", "active");

    // Fetch restaurants for names
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name");

    const restMap = new Map((restaurants || []).map(r => [r.id, r.name]));

    // Calculate MRR from active subscriptions
    const activeMRR = (subs || []).reduce((sum, s) => {
      const plan = s.subscription_plans as any;
      return sum + (plan?.price || 0);
    }, 0);
    setMrr(activeMRR);

    // Total revenue from paid payments
    const total = (payments || []).reduce((sum, p) => sum + p.amount, 0);
    setTotalRevenue(total);

    // Group by restaurant
    const byRestaurant = new Map<string, { total: number; last: string | null }>();
    (payments || []).forEach(p => {
      const curr = byRestaurant.get(p.restaurant_id) || { total: 0, last: null };
      curr.total += p.amount;
      if (!curr.last || p.payment_date > curr.last) curr.last = p.payment_date;
      byRestaurant.set(p.restaurant_id, curr);
    });

    const summaryList: PaymentSummary[] = Array.from(byRestaurant.entries()).map(([rid, data]) => ({
      restaurant_id: rid,
      restaurant_name: restMap.get(rid) || "—",
      total_paid: data.total,
      last_payment: data.last,
    })).sort((a, b) => b.total_paid - a.total_paid);

    setSummaries(summaryList);
    setLoading(false);
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Relatórios Financeiros</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> MRR (Receita Mensal Recorrente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">R$ {mrr.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Receita Total Recebida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">R$ {totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" /> Restaurantes Pagantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{summaries.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Faturamento por Restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum pagamento registrado ainda</p>
          ) : (
            <div className="space-y-3">
              {summaries.map(s => (
                <div key={s.restaurant_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{s.restaurant_name}</p>
                    {s.last_payment && (
                      <p className="text-xs text-muted-foreground">
                        Último pagamento: {format(new Date(s.last_payment), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-primary">R$ {s.total_paid.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
