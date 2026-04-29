import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { Plus, Trash2, Edit, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ALL_MODULES = [
  { id: "cardapio", label: "Cardápio Digital" },
  { id: "pdv", label: "PDV / Balcão" },
  { id: "mesas", label: "Mesas" },
  { id: "estoque", label: "Estoque" },
  { id: "financeiro", label: "Financeiro" },
  { id: "fidelidade", label: "Fidelidade" },
  { id: "delivery", label: "Delivery" },
  { id: "marketing", label: "Marketing" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "fiscal", label: "Fiscal / NF-e" },
  { id: "pagamentos_online", label: "Pagamentos Online" },
  { id: "reservas", label: "Reservas" },
  { id: "totem", label: "Totem / Autoatendimento" },
];

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string[];
  is_active: boolean | null;
  created_at: string | null;
  mp_subscription_link?: string | null;
}

export function SubscriptionPlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formFeatures, setFormFeatures] = useState<string[]>([]);
  const [formMpLink, setFormMpLink] = useState("");

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("price", { ascending: true });
    if (error) {
      setLoading(false);
      return;
    }
    const plansData = (data || []).map((d) => ({ ...d, features: (d.features as any) || [] }));

    // Buscar links MP de cada plano
    const planIds = plansData.map((p) => p.id);
    const { data: links } = await supabase
      .from("plan_payment_links" as any)
      .select("plan_id, mp_subscription_link")
      .in("plan_id", planIds);

    const linkMap = new Map<string, string>();
    (links as any[] | null)?.forEach((l) => linkMap.set(l.plan_id, l.mp_subscription_link));

    setPlans(plansData.map((p) => ({ ...p, mp_subscription_link: linkMap.get(p.id) || null })));
    setLoading(false);
  };

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormPrice(""); setFormActive(true); setFormFeatures([]); setFormMpLink(""); setEditing(null);
  };

  const openDialog = (plan?: Plan) => {
    if (plan) {
      setEditing(plan);
      setFormName(plan.name);
      setFormDesc(plan.description || "");
      setFormPrice(String(plan.price));
      setFormActive(plan.is_active ?? true);
      setFormFeatures(plan.features);
      setFormMpLink(plan.mp_subscription_link || "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const toggleFeature = (moduleId: string) => {
    setFormFeatures(prev =>
      prev.includes(moduleId) ? prev.filter(f => f !== moduleId) : [...prev, moduleId]
    );
  };

  const upsertPlanLink = async (planId: string) => {
    const trimmed = formMpLink.trim();
    if (!trimmed) {
      // Se vazio, remover link existente
      await supabase.from("plan_payment_links" as any).delete().eq("plan_id", planId);
      return;
    }
    // Upsert manual: tenta update; se 0 linhas, insert
    const { data: existing } = await supabase
      .from("plan_payment_links" as any)
      .select("id")
      .eq("plan_id", planId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("plan_payment_links" as any)
        .update({ mp_subscription_link: trimmed, is_active: true, updated_at: new Date().toISOString() })
        .eq("plan_id", planId);
    } else {
      await supabase
        .from("plan_payment_links" as any)
        .insert({ plan_id: planId, mp_subscription_link: trimmed, is_active: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formName,
      description: formDesc || null,
      price: parseFloat(formPrice) || 0,
      is_active: formActive,
      features: formFeatures as any,
    };

    try {
      let planId: string;
      if (editing) {
        const { error } = await supabase.from("subscription_plans").update(payload).eq("id", editing.id);
        if (error) throw error;
        planId = editing.id;
        toast.success("Plano atualizado");
      } else {
        const { data: created, error } = await supabase
          .from("subscription_plans")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        planId = created!.id;
        toast.success("Plano criado");
      }
      await upsertPlanLink(planId);
      setDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Plano excluído"); fetchPlans(); }
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Planos de Assinatura</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" /> Novo Plano</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Básico" required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Descrição do plano..." />
              </div>
              <div className="space-y-2">
                <Label>Preço Mensal (R$)</Label>
                <Input type="number" step="0.01" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="99.90" required />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formActive} onCheckedChange={setFormActive} />
                <Label>Ativo</Label>
              </div>
              <div className="space-y-2">
                <Label>Módulos Incluídos</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_MODULES.map(m => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={formFeatures.includes(m.id)}
                        onCheckedChange={() => toggleFeature(m.id)}
                      />
                      <span className="text-sm">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link de assinatura Mercado Pago</Label>
                <Input
                  type="url"
                  placeholder="https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=..."
                  value={formMpLink}
                  onChange={(e) => setFormMpLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Link gerado no Mercado Pago para este plano. Clientes serão redirecionados para cá ao fazer upgrade ou downgrade.
                </p>
              </div>
              <Button type="submit" className="w-full">{editing ? "Atualizar" : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum plano cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map(plan => (
            <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  {!plan.is_active && <Badge variant="secondary">Inativo</Badge>}
                </div>
                <p className="text-2xl font-bold text-primary">R$ {plan.price.toFixed(2)}<span className="text-sm text-muted-foreground font-normal">/mês</span></p>
                <p className="text-xs text-muted-foreground">≈ R$ {(plan.price / 30).toFixed(2)}/dia</p>
                {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {plan.features.map(f => (
                    <Badge key={f} variant="outline" className="text-xs">
                      {ALL_MODULES.find(m => m.id === f)?.label || f}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openDialog(plan)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(plan.id)}>
                    <Trash2 className="h-4 w-4" />
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
