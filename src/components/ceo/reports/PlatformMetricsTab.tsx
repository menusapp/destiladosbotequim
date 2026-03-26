import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Store, ShoppingBag, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PaymentSummary {
  restaurant_id: string;
  restaurant_name: string;
  total_paid: number;
  last_payment: string | null;
}

interface MonthlyMRR {
  month: string;
  value: number;
}

export function PlatformMetricsTab() {
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [subscriptionsSold, setSubscriptionsSold] = useState(0);
  const [partnerCount, setPartnerCount] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [summaries, setSummaries] = useState<PaymentSummary[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyMRR[]>([]);

  useEffect(() => {
    fetchPlatformMetrics();
  }, []);

  const fetchPlatformMetrics = async () => {
    try {
      // Active subscriptions for MRR
      const { data: subs } = await supabase
        .from("restaurant_subscriptions" as any)
        .select("*, subscription_plans(price)")
        .eq("status", "active") as any;

      const activeMRR = ((subs as any[]) || []).reduce((sum: number, s: any) => {
        return sum + (s.subscription_plans?.price || 0);
      }, 0);
      setMrr(activeMRR);

      // All paid payments
      const { data: payments } = await supabase
        .from("subscription_payments" as any)
        .select("*")
        .eq("status", "paid") as any;

      const allPayments = (payments as any[]) || [];
      const total = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      setTotalRevenue(total);
      setSubscriptionsSold(allPayments.length);
      setAvgTicket(allPayments.length > 0 ? total / allPayments.length : 0);

      // Restaurants
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name");

      const restMap = new Map((restaurants || []).map(r => [r.id, r.name]));

      // Unique paying restaurants
      const uniqueRestaurants = new Set(allPayments.map((p: any) => p.restaurant_id));
      setPartnerCount(uniqueRestaurants.size);

      // Group payments by restaurant
      const byRestaurant = new Map<string, { total: number; last: string | null }>();
      allPayments.forEach((p: any) => {
        const curr = byRestaurant.get(p.restaurant_id) || { total: 0, last: null };
        curr.total += p.amount;
        if (!curr.last || p.payment_date > curr.last) curr.last = p.payment_date;
        byRestaurant.set(p.restaurant_id, curr);
      });

      const summaryList: PaymentSummary[] = Array.from(byRestaurant.entries())
        .map(([rid, data]) => ({
          restaurant_id: rid,
          restaurant_name: restMap.get(rid) || "—",
          total_paid: data.total,
          last_payment: data.last,
        }))
        .sort((a, b) => b.total_paid - a.total_paid);
      setSummaries(summaryList);

      // Monthly MRR evolution (group payments by month)
      const byMonth = new Map<string, number>();
      allPayments.forEach((p: any) => {
        const d = new Date(p.payment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, (byMonth.get(key) || 0) + p.amount);
      });

      const monthlyArr: MonthlyMRR[] = Array.from(byMonth.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);
      setMonthlyData(monthlyArr);

    } catch (err) {
      console.error("Error fetching platform metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">R$ {mrr.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Faturamento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">R$ {totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Assinaturas Vendidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{subscriptionsSold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" /> Restaurantes Parceiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{partnerCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">R$ {avgTicket.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* MRR Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Evolução MRR (últimos 12 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem dados de pagamentos</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Subscription Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Pagamentos por Restaurante
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum pagamento registrado</p>
          ) : (
            <div className="space-y-3">
              {summaries.map(s => (
                <div key={s.restaurant_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{s.restaurant_name}</p>
                    {s.last_payment && (
                      <p className="text-xs text-muted-foreground">
                        Último: {format(new Date(s.last_payment), "dd/MM/yyyy")}
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
