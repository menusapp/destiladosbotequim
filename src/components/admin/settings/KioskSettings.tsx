import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Monitor,
  Copy,
  ExternalLink,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  Store,
  Users,
  Gift,
  Tag,
  Percent,
  Timer,
  Loader2,
  Save,
} from "lucide-react";

interface Props {
  restaurantId: string;
}

interface KioskConfig {
  id: string;
  enabled: boolean;
  payment_cash: boolean;
  payment_card: boolean;
  payment_pix: boolean;
  payment_online: boolean;
  order_dine_in: boolean;
  order_takeaway: boolean;
  order_pickup: boolean;
  order_delivery: boolean;
  require_cpf: boolean;
  loyalty_enabled: boolean;
  coupons_enabled: boolean;
  promotions_enabled: boolean;
  inactivity_timeout_seconds: number;
}

export default function KioskSettings({ restaurantId }: Props) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<KioskConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string>("");

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("slug")
        .eq("id", restaurantId)
        .single();
      if (rest) setSlug(rest.slug);

      const { data, error } = await supabase
        .from("kiosk_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as any);
        setSavedConfig(data as any);
      } else {
        const { data: newConfig, error: insertErr } = await supabase
          .from("kiosk_config")
          .insert({ restaurant_id: restaurantId })
          .select()
          .single();
        if (insertErr) throw insertErr;
        setConfig(newConfig as any);
        setSavedConfig(newConfig as any);
      }
    } catch (err) {
      console.error("[KioskSettings] Error loading config:", err);
      toast.error("Erro ao carregar configurações do Totem");
    } finally {
      setLoading(false);
    }
  };

  const updateLocal = (updates: Partial<KioskConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  const hasChanges = config && savedConfig
    ? JSON.stringify(config) !== JSON.stringify(savedConfig)
    : false;

  const saveAllChanges = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { id, ...updates } = config;
      const { error } = await supabase
        .from("kiosk_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", config.id);
      if (error) throw error;
      setSavedConfig({ ...config });
      console.log("[KioskSettings] Configurações salvas com sucesso:", updates);
      toast.success("Configurações do Totem salvas com sucesso!");
    } catch (err) {
      console.error("[KioskSettings] Error saving:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const kioskUrl = slug
    ? `${window.location.origin}/${slug}/kiosk`
    : "";

  const copyLink = () => {
    if (!kioskUrl) return;
    navigator.clipboard.writeText(kioskUrl);
    toast.success("Link copiado!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Save button - sticky top */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Configurações do Totem</h2>
            <p className="text-sm text-muted-foreground">Gerencie o autoatendimento</p>
          </div>
          <Button
            onClick={saveAllChanges}
            disabled={saving || !hasChanges}
            className="h-11 px-6 text-base font-bold gap-2"
            variant={hasChanges ? "default" : "outline"}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4" /> Salvar atualizações</>
            )}
          </Button>
        </div>
        {hasChanges && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
            ⚠️ Você tem alterações não salvas
          </p>
        )}
      </div>

      {/* Status do Módulo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Status do Totem</CardTitle>
                <CardDescription>Ative ou desative o autoatendimento</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={config.enabled ? "default" : "secondary"}>
                {config.enabled ? "Ativo" : "Inativo"}
              </Badge>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => updateLocal({ enabled: v })}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Link do Totem */}
      {config.enabled && kioskUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              Link do Totem
            </CardTitle>
            <CardDescription>
              Use este link no navegador do totem/tablet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input value={kioskUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={kioskUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tipos de Pedido */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tipos de Pedido</CardTitle>
          <CardDescription>Quais opções de consumo o cliente pode escolher</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            icon={UtensilsCrossed}
            label="Comer no local"
            description="Cliente consome no estabelecimento"
            checked={config.order_dine_in}
            onChange={(v) => updateLocal({ order_dine_in: v })}
          />
          <Separator />
          <ToggleRow
            icon={ShoppingBag}
            label="Para viagem"
            description="Cliente retira e leva"
            checked={config.order_takeaway}
            onChange={(v) => updateLocal({ order_takeaway: v })}
          />
          <Separator />
          <ToggleRow
            icon={Store}
            label="Retirada no balcão"
            description="Cliente retira no balcão"
            checked={config.order_pickup}
            onChange={(v) => updateLocal({ order_pickup: v })}
          />
          <Separator />
          <ToggleRow
            icon={Truck}
            label="Entrega"
            description="Pedido para entrega (quando disponível)"
            checked={config.order_delivery}
            onChange={(v) => updateLocal({ order_delivery: v })}
          />
        </CardContent>
      </Card>

      {/* Formas de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
          <CardDescription>Meios de pagamento aceitos no totem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            icon={Banknote}
            label="Dinheiro"
            description="Pagamento em espécie com cálculo de troco"
            checked={config.payment_cash}
            onChange={(v) => updateLocal({ payment_cash: v })}
          />
          <Separator />
          <ToggleRow
            icon={CreditCard}
            label="Cartão na maquininha"
            description="Pagamento na maquininha ao lado do totem"
            checked={config.payment_card}
            onChange={(v) => updateLocal({ payment_card: v })}
          />
          <Separator />
          <ToggleRow
            icon={QrCode}
            label="PIX"
            description="Pagamento via QR Code PIX"
            checked={config.payment_pix}
            onChange={(v) => updateLocal({ payment_pix: v })}
          />
          <Separator />
          <ToggleRow
            icon={Smartphone}
            label="Pagamento online"
            description="Cartão online integrado (futura integração)"
            checked={config.payment_online}
            onChange={(v) => updateLocal({ payment_online: v })}
          />
        </CardContent>
      </Card>

      {/* Identificação do Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Identificação do Cliente
          </CardTitle>
          <CardDescription>Configurações de CRM e identificação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            icon={Users}
            label="Exigir CPF"
            description="Obrigar identificação por CPF antes do pedido"
            checked={config.require_cpf}
            onChange={(v) => updateLocal({ require_cpf: v })}
          />
        </CardContent>
      </Card>

      {/* Fidelidade e Cupons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Fidelidade e Promoções
          </CardTitle>
          <CardDescription>Recursos de engajamento no totem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            icon={Gift}
            label="Programa de fidelidade"
            description="Acumular e resgatar pontos no totem"
            checked={config.loyalty_enabled}
            onChange={(v) => updateLocal({ loyalty_enabled: v })}
          />
          <Separator />
          <ToggleRow
            icon={Tag}
            label="Cupons de desconto"
            description="Permitir aplicar cupons no totem"
            checked={config.coupons_enabled}
            onChange={(v) => updateLocal({ coupons_enabled: v })}
          />
          <Separator />
          <ToggleRow
            icon={Percent}
            label="Promoções automáticas"
            description="Exibir descontos e promoções vigentes"
            checked={config.promotions_enabled}
            onChange={(v) => updateLocal({ promotions_enabled: v })}
          />
        </CardContent>
      </Card>

      {/* Timeout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Timeout de Inatividade
          </CardTitle>
          <CardDescription>Tempo para resetar sessão automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label>Segundos de inatividade:</Label>
            <Input
              type="number"
              value={config.inactivity_timeout_seconds}
              onChange={(e) => {
                const val = Math.max(30, parseInt(e.target.value) || 120);
                updateLocal({ inactivity_timeout_seconds: val });
              }}
              className="w-24"
              min={30}
              max={600}
            />
            <span className="text-sm text-muted-foreground">
              ({Math.floor(config.inactivity_timeout_seconds / 60)}m {config.inactivity_timeout_seconds % 60}s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save button */}
      {hasChanges && (
        <div className="pb-8">
          <Button
            onClick={saveAllChanges}
            disabled={saving}
            className="w-full h-12 text-base font-bold gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4" /> Salvar atualizações</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: any;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
