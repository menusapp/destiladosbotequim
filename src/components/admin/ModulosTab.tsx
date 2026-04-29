import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Check, Crown, ArrowUp, ArrowDown, Package, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/metaPixel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";

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

const PLAN_TEXT_FEATURES: Record<string, string[]> = {
  "básico": [
    "Cardápio digital ilimitado",
    "QR Code para mesas",
    "Pedidos em tempo real",
    "1 usuário administrador",
    "Suporte por email",
  ],
  "intermediário": [
    "Tudo do Básico",
    "Delivery completo",
    "Gestão de estoque & CMV",
    "Relatórios e DRE",
    "Programa de fidelidade",
    "Até 5 usuários",
    "Suporte prioritário",
  ],
  "avançado": [
    "Tudo do Intermediário",
    "Marketing WhatsApp",
    "Remarketing automático",
    "Nota fiscal eletrônica",
    "Fluxo de caixa & DRE",
    "Reservas online",
    "Usuários ilimitados",
    "Suporte VIP",
  ],
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
  pending_downgrade_plan_id?: string | null;
  pending_downgrade_at?: string | null;
}

interface ModulosTabProps {
  restaurantId: string;
}

interface UpgradePreview {
  url: string;
  planName: string;
  planPrice: number;
  prorateAmount: number;
  daysUntilRenewal: number;
}

export default function ModulosTab({ restaurantId }: ModulosTabProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [downgradeConfirm, setDowngradeConfirm] = useState<{ plan: Plan } | null>(null);
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
        .in("status", ["active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (plansRes.data) {
      setPlans(plansRes.data.map((d: any) => ({ ...d, features: d.features || [] })));
    }

    const subRow = subRes.data?.[0];
    if (subRow && subRow.subscription_plans) {
      const sp = subRow.subscription_plans as any;
      setActiveSub({
        id: subRow.id,
        plan_id: subRow.plan_id,
        status: subRow.status,
        plan_name: sp.name,
        plan_price: sp.price,
        plan_features: sp.features || [],
        pending_downgrade_plan_id: (subRow as any).pending_downgrade_plan_id,
        pending_downgrade_at: (subRow as any).pending_downgrade_at,
      });
    } else {
      setActiveSub(null);
    }

    setLoading(false);
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (activeSub?.plan_id === plan.id) return;

    // Sem assinatura ainda — tratar como upgrade direto (assinar)
    const action: "upgrade" | "downgrade" =
      !activeSub || plan.price >= activeSub.plan_price ? "upgrade" : "downgrade";

    if (action === "downgrade") {
      setDowngradeConfirm({ plan });
      return;
    }

    setLoadingPlanId(plan.id);

    try {
      const { data, error } = await supabase.functions.invoke("manage-plan-change", {
        body: {
          restaurant_id: restaurantId,
          action: "upgrade",
          target_plan_id: plan.id,
        },
      });

      if (error || !data?.redirect_url) {
        throw new Error((data as any)?.error || error?.message || "Erro ao iniciar upgrade");
      }

      // Pixel
      trackEvent("AddToCart", {
        content_name: `Plano ${plan.name}`,
        content_ids: [plan.id],
        content_type: "subscription_plan",
        value: plan.price,
        currency: "BRL",
      });

      setUpgradePreview({
        url: data.redirect_url,
        planName: data.plan_name,
        planPrice: data.plan_price,
        prorateAmount: data.prorate_amount || 0,
        daysUntilRenewal: data.days_until_renewal || 0,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar upgrade");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const confirmDowngrade = async () => {
    if (!downgradeConfirm) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-plan-change", {
        body: {
          restaurant_id: restaurantId,
          action: "downgrade",
          target_plan_id: downgradeConfirm.plan.id,
        },
      });

      if (error || !data?.redirect_url) {
        throw new Error((data as any)?.error || error?.message || "Erro ao agendar downgrade");
      }

      toast.success(
        `Downgrade agendado! Seu plano atual continua ativo até ${new Date(
          data.renewal_date
        ).toLocaleDateString("pt-BR")}.`
      );

      // Abrir link MP em nova aba para o usuário aprovar a nova assinatura
      window.open(data.redirect_url, "_blank");

      setDowngradeConfirm(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar downgrade");
    } finally {
      setSubmitting(false);
    }
  };

  const goToPayment = () => {
    if (!upgradePreview) return;
    trackEvent("InitiateCheckout", {
      content_name: `Checkout - ${upgradePreview.planName}`,
      value: upgradePreview.planPrice,
      currency: "BRL",
    });
    setTimeout(() => {
      window.location.href = upgradePreview.url;
    }, 400);
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

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Escolha seu plano</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {activeSub ? (
            <>
              Plano atual: <span className="font-semibold text-primary">{activeSub.plan_name}</span> — R${" "}
              {activeSub.plan_price.toFixed(2)}/mês
            </>
          ) : (
            "Selecione o plano ideal para desbloquear os módulos do seu restaurante"
          )}
        </p>
        {activeSub?.pending_downgrade_plan_id && activeSub?.pending_downgrade_at && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Downgrade agendado para{" "}
            {new Date(activeSub.pending_downgrade_at).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-3 items-start">
        {plans.map((plan) => {
          const isCurrent = activeSub?.plan_id === plan.id;
          const isUpgrade = activeSub ? plan.price > activeSub.plan_price : false;
          const isDowngrade = activeSub ? plan.price < activeSub.plan_price : false;
          const isLoadingThis = loadingPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border bg-card p-6 transition-all duration-200 ${
                isCurrent
                  ? "border-primary/60 ring-2 ring-primary/15 shadow-md"
                  : "border-border hover:border-primary/20 hover:shadow-sm"
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] gap-1 px-3 py-0.5 shadow-sm">
                    <Crown className="h-3 w-3" /> Atual
                  </Badge>
                </div>
              )}

              <div className="pt-2 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{plan.description}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      R$ {plan.price.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    R$ {(plan.price / 30).toFixed(2).replace(".", ",")}/dia
                  </p>
                </div>

                {isCurrent ? (
                  <Button disabled variant="outline" className="w-full text-xs h-9 opacity-60">
                    Plano Ativo
                  </Button>
                ) : (
                  <Button
                    className="w-full text-xs h-9"
                    variant={isUpgrade || !activeSub ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isLoadingThis}
                  >
                    {isLoadingThis ? (
                      "Processando..."
                    ) : (
                      <>
                        {isUpgrade && <ArrowUp className="h-3.5 w-3.5 mr-1" />}
                        {isDowngrade && <ArrowDown className="h-3.5 w-3.5 mr-1" />}
                        {!activeSub ? "Assinar" : isUpgrade ? "Upgrade" : "Downgrade"}
                      </>
                    )}
                  </Button>
                )}

                <div className="border-t border-border" />

                {PLAN_TEXT_FEATURES[plan.name.toLowerCase()] && (
                  <ul className="space-y-2">
                    {PLAN_TEXT_FEATURES[plan.name.toLowerCase()].map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5 text-sm text-foreground">
                        <div className="flex-shrink-0 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary" />
                        </div>
                        <span className="text-xs">{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {plan.features.length > 0 && (
                  <>
                    <div className="border-t border-border" />
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                        Módulos incluídos
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px]">
                            {ALL_MODULES[f] || f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de pré-visualização do UPGRADE com pró-rata */}
      <Dialog open={!!upgradePreview} onOpenChange={(o) => !o && setUpgradePreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade para {upgradePreview?.planName}</DialogTitle>
            <DialogDescription>
              Revise o valor proporcional antes de continuar para o pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dias até a renovação (dia 5)</span>
                <span className="font-medium">{upgradePreview?.daysUntilRenewal} dias</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor proporcional hoje</span>
                <span className="font-semibold text-primary text-base">
                  R$ {upgradePreview?.prorateAmount.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">A partir do dia 5</span>
                <span className="font-medium">
                  R$ {upgradePreview?.planPrice.toFixed(2).replace(".", ",")}/mês
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Você será redirecionado para o Mercado Pago para concluir o pagamento com segurança.
              O upgrade é ativado automaticamente após a confirmação.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradePreview(null)}>
              Cancelar
            </Button>
            <Button onClick={goToPayment}>
              Continuar para pagamento
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de DOWNGRADE */}
      <AlertDialog open={!!downgradeConfirm} onOpenChange={(o) => !submitting && !o && setDowngradeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fazer downgrade para {downgradeConfirm?.plan.name}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Seu plano atual <strong>{activeSub?.plan_name}</strong> continuará ativo até o dia 5
                do próximo ciclo.
              </span>
              <span className="block">
                A partir daí, você passará para <strong>{downgradeConfirm?.plan.name}</strong> (R${" "}
                {downgradeConfirm?.plan.price.toFixed(2)}/mês).
              </span>
              <span className="block text-xs text-muted-foreground pt-2">
                Você precisará aprovar a nova assinatura no Mercado Pago. Abriremos o link para você.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDowngrade} disabled={submitting}>
              {submitting ? "Processando..." : "Sim, fazer downgrade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
