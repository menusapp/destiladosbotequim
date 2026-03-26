import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Check, Crown, ArrowUp, ArrowDown, Package, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ALL_MODULES: Record<string, string> = {
  cardapio: "Cardápio Digital",
  pdv: "PDV / Balcão",
  mesas: "Mesas",
  estoque: "Estoque",
  financeiro: "Financeiro",
  fidelidade: "Fidelidade",
  delivery: "Delivery",
  marketing: "Marketing",
  whatsapp: "WhatsApp",
  fiscal: "Fiscal / NF-e",
  pagamentos_online: "Pagamentos Online",
  reservas: "Reservas",
};

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string[];
  is_active: boolean | null;
}

interface ActiveSubscription {
  id: string;
  plan_id: string;
  status: string;
  plan_name: string;
  plan_price: number;
  plan_features: string[];
}

interface ModulosTabProps {
  restaurantId: string;
}

export default function ModulosTab({ restaurantId }: ModulosTabProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ plan: Plan; action: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, subRes] = await Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true }),
      supabase
        .from("restaurant_subscriptions")
        .select("*, subscription_plans(name, price, features)")
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (plansRes.data) {
      setPlans(plansRes.data.map((d: any) => ({ ...d, features: d.features || [] })));
    }

    if (subRes.data && subRes.data.subscription_plans) {
      const sp = subRes.data.subscription_plans as any;
      setActiveSub({
        id: subRes.data.id,
        plan_id: subRes.data.plan_id,
        status: subRes.data.status,
        plan_name: sp.name,
        plan_price: sp.price,
        plan_features: sp.features || [],
      });
    } else {
      setActiveSub(null);
    }

    setLoading(false);
  };

  const handleSelectPlan = (plan: Plan) => {
    if (activeSub?.plan_id === plan.id) return;
    let action = "Assinar";
    if (activeSub) {
      action = plan.price > activeSub.plan_price ? "Fazer Upgrade" : "Fazer Downgrade";
    }
    setConfirmDialog({ plan, action });
  };

  const confirmSubscription = async () => {
    if (!confirmDialog) return;
    setSubmitting(true);

    try {
      if (activeSub) {
        const { error: deactivateErr } = await supabase
          .from("restaurant_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", activeSub.id);
        if (deactivateErr) throw deactivateErr;
      }

      const { error: insertErr } = await supabase
        .from("restaurant_subscriptions")
        .insert({
          restaurant_id: restaurantId,
          plan_id: confirmDialog.plan.id,
          status: "active",
        });
      if (insertErr) throw insertErr;

      toast.success(`Plano "${confirmDialog.plan.name}" ativado com sucesso!`);
      setConfirmDialog(null);
      fetchData();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar plano");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Carregando planos...</div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
        </div>
      </div>
    );
  }

  // Find the "recommended" plan (middle one, or most expensive if only 2)
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Escolha seu plano</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {activeSub
            ? <>Plano atual: <span className="font-semibold text-primary">{activeSub.plan_name}</span> — R$ {activeSub.plan_price.toFixed(2)}/mês</>
            : "Selecione o plano ideal para desbloquear os módulos do seu restaurante"}
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-5 md:grid-cols-3 items-start">
        {plans.map((plan) => {
          const isCurrent = activeSub?.plan_id === plan.id;
          const isUpgrade = activeSub ? plan.price > activeSub.plan_price : false;
          const isDowngrade = activeSub ? plan.price < activeSub.plan_price : false;

          return (
            <div
              key={plan.id}
              className={`
                relative rounded-2xl border bg-card p-6 transition-all duration-200
                ${isCurrent
                  ? "border-primary/60 ring-2 ring-primary/15 shadow-md"
                  : "border-border hover:border-primary/20 hover:shadow-sm"
                }
              `}
            >
              {/* Badges */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] gap-1 px-3 py-0.5 shadow-sm">
                    <Crown className="h-3 w-3" /> Atual
                  </Badge>
                </div>
              )}

              {/* Plan Info */}
              <div className="pt-2 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{plan.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    R$ {plan.price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>

                {/* CTA Button */}
                {isCurrent ? (
                  <Button disabled variant="outline" className="w-full text-xs h-9 opacity-60">
                    Plano Ativo
                  </Button>
                ) : (
                  <Button
                    className="w-full text-xs h-9"
                    variant={isUpgrade || !activeSub ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isUpgrade && <ArrowUp className="h-3.5 w-3.5 mr-1" />}
                    {isDowngrade && <ArrowDown className="h-3.5 w-3.5 mr-1" />}
                    {!activeSub ? "Assinar" : isUpgrade ? "Upgrade" : "Downgrade"}
                  </Button>
                )}

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Features */}
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                      <div className="flex-shrink-0 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary" />
                      </div>
                      <span className="text-xs">{ALL_MODULES[f] || f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.action}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeSub ? (
                <>
                  Trocar de <strong>{activeSub.plan_name}</strong> para{" "}
                  <strong>{confirmDialog?.plan.name}</strong> (R${" "}
                  {confirmDialog?.plan.price.toFixed(2)}/mês)?
                </>
              ) : (
                <>
                  Assinar o plano <strong>{confirmDialog?.plan.name}</strong> por R${" "}
                  {confirmDialog?.plan.price.toFixed(2)}/mês?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubscription} disabled={submitting}>
              {submitting ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
