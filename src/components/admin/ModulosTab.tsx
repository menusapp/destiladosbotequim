import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Check, Crown, ArrowUp, ArrowDown, Package, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/metaPixel";
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

// Links de assinatura do Mercado Pago por slug do plano
const MP_PLAN_LINKS: Record<string, string> = {
  basico: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=ce558ba8031d48e78c875adbe8af561a",
  intermediario: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=fe9ff4a87e634b86a493887ab8737b17",
  avancado: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=e0f8cd5628974aa180490d2b6e9d78ea",
};

// Normaliza nome do plano para slug (remove acentos, lowercase)
function planNameToSlug(name: string): string | null {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (normalized.includes("basic")) return "basico";
  if (normalized.includes("interm")) return "intermediario";
  if (normalized.includes("avanc")) return "avancado";
  return null;
}

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
    const slug = planNameToSlug(plan.name);
    if (!slug || !MP_PLAN_LINKS[slug]) {
      toast.error("Link de pagamento indisponível para este plano. Contate o suporte.");
      return;
    }
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
      const slug = planNameToSlug(confirmDialog.plan.name);
      if (!slug || !MP_PLAN_LINKS[slug]) {
        throw new Error("Link de pagamento indisponível.");
      }

      // Meta Pixel — clique para ir até o checkout do MP conta como AddToCart
      trackEvent("AddToCart", {
        content_name: `Plano ${confirmDialog.plan.name}`,
        content_ids: [slug],
        content_type: "subscription_plan",
        value: confirmDialog.plan.price,
        currency: "BRL",
      });
      // E também InitiateCheckout, já que estamos saindo para a página de pagamento
      trackEvent("InitiateCheckout", {
        content_name: `Checkout - Plano ${confirmDialog.plan.name}`,
        content_ids: [slug],
        content_type: "subscription_plan",
        value: confirmDialog.plan.price,
        currency: "BRL",
      });

      // Monta URL com external_reference = restaurant_id (necessário para o webhook reconhecer)
      const mpUrl = new URL(MP_PLAN_LINKS[slug]);
      mpUrl.searchParams.set("external_reference", restaurantId);

      toast.success("Redirecionando para o pagamento...");
      // Pequeno delay para o pixel disparar antes do redirect
      setTimeout(() => {
        window.location.href = mpUrl.toString();
      }, 600);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar pagamento");
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

                {/* Textual Features from LP */}
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

                {/* Module badges */}
                {plan.features.length > 0 && (
                  <>
                    <div className="border-t border-border" />
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Módulos incluídos</p>
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
