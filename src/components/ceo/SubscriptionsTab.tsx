import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { CreditCard, CheckCircle, XCircle, AlertTriangle, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface Restaurant { id: string; name: string; slug: string; }
interface Plan { id: string; name: string; price: number; }
interface Subscription {
  id: string;
  restaurant_id: string;
  plan_id: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  next_payment_at: string | null;
  last_payment_at: string | null;
  created_at: string | null;
}

export function SubscriptionsTab() {
  const [latestSubs, setLatestSubs] = useState<Subscription[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [filterInadimplente, setFilterInadimplente] = useState(false);

  const [formRestaurant, setFormRestaurant] = useState("");
  const [formPlan, setFormPlan] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMonth, setPaymentMonth] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [subsRes, restRes, planRes] = await Promise.all([
      supabase.from("restaurant_subscriptions" as any).select("*").order("created_at", { ascending: false }) as any,
      supabase.from("restaurants").select("id, name, slug").order("name"),
      supabase.from("subscription_plans").select("id, name, price").eq("is_active", true),
    ]);

    const allSubs: Subscription[] = subsRes.data || [];
    const restaurants = restRes.data || [];
    const plans = planRes.data || [];

    // Keep only the most recent subscription per restaurant
    const latestMap: Record<string, Subscription> = {};
    allSubs.forEach(s => {
      const existing = latestMap[s.restaurant_id];
      if (!existing || new Date(s.created_at || 0) > new Date(existing.created_at || 0)) {
        latestMap[s.restaurant_id] = s;
      }
    });

    setLatestSubs(Object.values(latestMap));
    setRestaurants(restaurants);
    setPlans(plans);
    setLoading(false);
  };

  const getRestaurantName = (id: string) => restaurants.find(r => r.id === id)?.name || "—";
  const getPlanName = (id: string) => plans.find(p => p.id === id)?.name || "—";

  const isInadimplente = (sub: Subscription) => {
    if (sub.status !== "active" || !sub.next_payment_at) return false;
    return new Date(sub.next_payment_at) < new Date();
  };

  const statusBadge = (status: string, sub?: Subscription) => {
    if (sub && isInadimplente(sub)) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Inadimplente</Badge>;
    }
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Ativo", variant: "default" },
      suspended: { label: "Suspenso", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "secondary" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filteredSubs = filterInadimplente
    ? latestSubs.filter(isInadimplente)
    : latestSubs;

  const inadimplenteCount = latestSubs.filter(isInadimplente).length;

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);

    // Cancel all previous subscriptions for this restaurant
    await (supabase.from("restaurant_subscriptions" as any) as any)
      .update({ status: "cancelled" })
      .eq("restaurant_id", formRestaurant);

    const { error } = await (supabase.from("restaurant_subscriptions" as any) as any).insert({
      restaurant_id: formRestaurant,
      plan_id: formPlan,
      status: "active",
      started_at: now,
      next_payment_at: nextPayment.toISOString(),
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Assinatura criada");
      setDialogOpen(false);
      fetchAll();
    }
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const newStatus = sub.status === "active" ? "suspended" : "active";
    const { error } = await (supabase.from("restaurant_subscriptions" as any) as any).update({ status: newStatus }).eq("id", sub.id);
    if (error) toast.error(error.message);
    else { toast.success(`Assinatura ${newStatus === "active" ? "reativada" : "suspensa"}`); fetchAll(); }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    const { error } = await (supabase.from("subscription_payments" as any) as any).insert({
      subscription_id: selectedSub.id,
      restaurant_id: selectedSub.restaurant_id,
      amount: parseFloat(paymentAmount),
      status: "paid",
      reference_month: paymentMonth,
      payment_date: new Date().toISOString(),
    });

    if (!error) {
      const nextPayment = new Date();
      nextPayment.setMonth(nextPayment.getMonth() + 1);
      await (supabase.from("restaurant_subscriptions" as any) as any).update({
        last_payment_at: new Date().toISOString(),
        next_payment_at: nextPayment.toISOString(),
        status: "active",
      }).eq("id", selectedSub.id);

      toast.success("Pagamento registrado");
      setPaymentDialogOpen(false);
      setSelectedSub(null);
      fetchAll();
    } else {
      toast.error(error.message);
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Assinaturas</h2>
          {inadimplenteCount > 0 && (
            <Button
              variant={filterInadimplente ? "destructive" : "outline"}
              size="sm"
              onClick={() => setFilterInadimplente(!filterInadimplente)}
            >
              <Filter className="h-4 w-4 mr-1" />
              {inadimplenteCount} Inadimplente{inadimplenteCount > 1 ? "s" : ""}
            </Button>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><CreditCard className="h-4 w-4 mr-2" /> Nova Assinatura</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Assinatura</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateSubscription} className="space-y-4">
              <div className="space-y-2">
                <Label>Restaurante</Label>
                <Select value={formRestaurant} onValueChange={setFormRestaurant}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {restaurants.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {p.price.toFixed(2)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={!formRestaurant || !formPlan}>Criar Assinatura</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <form onSubmit={handleRegisterPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mês Referência (ex: 2026-03)</Label>
              <Input value={paymentMonth} onChange={e => setPaymentMonth(e.target.value)} placeholder="2026-03" required />
            </div>
            <Button type="submit" className="w-full">Confirmar Pagamento</Button>
          </form>
        </DialogContent>
      </Dialog>

      {latestSubs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma assinatura ativa</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubs.map(sub => (
            <Card key={sub.id} className={isInadimplente(sub) ? "border-destructive/50" : ""}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getRestaurantName(sub.restaurant_id)}</span>
                    {statusBadge(sub.status, sub)}
                  </div>
                  <p className="text-sm text-muted-foreground">Plano: {getPlanName(sub.plan_id)}</p>
                  {sub.next_payment_at && (
                    <p className="text-xs text-muted-foreground">
                      Próx. pagamento: {format(new Date(sub.next_payment_at), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSub(sub);
                      const plan = plans.find(p => p.id === sub.plan_id);
                      setPaymentAmount(String(plan?.price || 0));
                      setPaymentMonth(format(new Date(), "yyyy-MM"));
                      setPaymentDialogOpen(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-1" /> Pagamento
                  </Button>
                  <Button
                    variant={sub.status === "active" ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleStatus(sub)}
                  >
                    {sub.status === "active" ? <XCircle className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    {sub.status === "active" ? "Suspender" : "Reativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
