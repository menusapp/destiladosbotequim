import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Crown, ArrowUp, ArrowDown, Package } from "lucide-react";
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
      // Deactivate current subscription if exists
      if (activeSub) {
        const { error: deactivateErr } = await supabase
          .from("restaurant_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", activeSub.id);
        if (deactivateErr) throw deactivateErr;
      }

      // Create new subscription
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
      // Reload page to refresh sidebar modules
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar plano");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground p-4">Carregando planos...</p>;
  }

  if (plans.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum plano disponível no momento.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Módulos e Assinaturas</h2>
        <p className="text-muted-foreground mt-1">
          {activeSub
            ? `Plano atual: ${activeSub.plan_name} — R$ ${activeSub.plan_price.toFixed(2)}/mês`
            : "Escolha um plano para desbloquear os módulos do sistema"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = activeSub?.plan_id === plan.id;
          const isUpgrade = activeSub ? plan.price > activeSub.plan_price : false;
          const isDowngrade = activeSub ? plan.price < activeSub.plan_price : false;

          return (
            <Card
              key={plan.id}
              className={`relative transition-all ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-primary/50"
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <Crown className="h-3 w-3" /> Plano Atual
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-3xl font-bold text-primary">
                  R$ {plan.price.toFixed(2)}
                  <span className="text-sm text-muted-foreground font-normal">/mês</span>
                </p>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{ALL_MODULES[f] || f}</span>
                    </div>
                  ))}
                </div>

                {isCurrent ? (
                  <Button disabled className="w-full" variant="outline">
                    Plano Ativo
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isUpgrade || !activeSub ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isUpgrade && <ArrowUp className="h-4 w-4 mr-1" />}
                    {isDowngrade && <ArrowDown className="h-4 w-4 mr-1" />}
                    {!activeSub ? "Assinar" : isUpgrade ? "Upgrade" : "Downgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.action}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeSub ? (
                <>
                  Você está trocando do plano <strong>{activeSub.plan_name}</strong> para o plano{" "}
                  <strong>{confirmDialog?.plan.name}</strong> (R${" "}
                  {confirmDialog?.plan.price.toFixed(2)}/mês). Deseja continuar?
                </>
              ) : (
                <>
                  Você está assinando o plano <strong>{confirmDialog?.plan.name}</strong> por R${" "}
                  {confirmDialog?.plan.price.toFixed(2)}/mês. Deseja continuar?
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
