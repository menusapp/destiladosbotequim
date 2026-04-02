import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Copy, ExternalLink, Power, CreditCard, Banknote, QrCode, Smartphone,
  UtensilsCrossed, ShoppingBag, Truck, Store, Users, Gift, Tag, Percent, Timer, Loader2, Save,
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
  const [localConfig, setLocalConfig] = useState<KioskConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  useEffect(() => {
    if (config && localConfig) {
      setHasChanges(JSON.stringify(config) !== JSON.stringify(localConfig));
    }
  }, [config, localConfig]);

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
        setLocalConfig(data as any);
      } else {
        const { data: newConfig, error: insertErr } = await supabase
          .from("kiosk_config")
          .insert({ restaurant_id: restaurantId })
          .select()
          .single();
        if (insertErr) throw insertErr;
        setConfig(newConfig as any);
        setLocalConfig(newConfig as any);
      }
    } catch (err) {
      console.error("[KioskSettings] Error loading config:", err);
      toast.error("Erro ao carregar configurações do Totem");
    } finally {
      setLoading(false);
    }
  };

  const updateLocal = (updates: Partial<KioskConfig>) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, ...updates });
  };

  const handleSave = async () => {
    if (!localConfig || !config) return;
    setSaving(true);
    try {
      const payload = { ...localConfig, updated_at: new Date().toISOString() };
      delete (payload as any).id;
      const { error } = await supabase
        .from("kiosk_config")
        .update(payload)
        .eq("id", config.id);
      if (error) throw error;
      setConfig({ ...localConfig });
      setHasChanges(false);
      toast.success("Configurações do Totem salvas!");
    } catch (err) {
      console.error("[KioskSettings] Erro ao salvar:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const kioskUrl = slug ? `${window.location.origin}/${slug}/kiosk` : "";

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

  if (!localConfig) return null;

  return (
    <div className="space-y-4">
      {/* Save button sticky */}
      {hasChanges && (
        <div className="sticky top-0 z-10 bg-card border rounded-xl p-3 shadow-lg flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Você tem alterações não salvas</span>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      )}

      {/* Row 1: Status + Link */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Status do Totem</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={localConfig.enabled ? "default" : "secondary"} className="text-xs">
                  {localConfig.enabled ? "Ativo" : "Inativo"}
                </Badge>
                <Switch
                  checked={localConfig.enabled}
                  onCheckedChange={(v) => updateLocal({ enabled: v })}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Link */}
        {localConfig.enabled && kioskUrl && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-primary" />
                Link do Totem
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Input value={kioskUrl} readOnly className="font-mono text-xs h-8" />
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <a href={kioskUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 2: Order Types + Payments (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tipos de Pedido</CardTitle>
            <CardDescription className="text-xs">Opções de consumo disponíveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <ToggleRow icon={UtensilsCrossed} label="Comer no local" checked={localConfig.order_dine_in} onChange={(v) => updateLocal({ order_dine_in: v })} />
            <ToggleRow icon={ShoppingBag} label="Para viagem" checked={localConfig.order_takeaway} onChange={(v) => updateLocal({ order_takeaway: v })} />
            <ToggleRow icon={Store} label="Retirada no balcão" checked={localConfig.order_pickup} onChange={(v) => updateLocal({ order_pickup: v })} />
            <ToggleRow icon={Truck} label="Entrega" checked={localConfig.order_delivery} onChange={(v) => updateLocal({ order_delivery: v })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Formas de Pagamento</CardTitle>
            <CardDescription className="text-xs">Meios aceitos no totem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <ToggleRow icon={Banknote} label="Dinheiro" checked={localConfig.payment_cash} onChange={(v) => updateLocal({ payment_cash: v })} />
            <ToggleRow icon={CreditCard} label="Cartão na maquininha" checked={localConfig.payment_card} onChange={(v) => updateLocal({ payment_card: v })} />
            <ToggleRow icon={QrCode} label="PIX" checked={localConfig.payment_pix} onChange={(v) => updateLocal({ payment_pix: v })} />
            <ToggleRow icon={Smartphone} label="Pagamento online" checked={localConfig.payment_online} onChange={(v) => updateLocal({ payment_online: v })} />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Identification + Loyalty + Timeout (3 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Identificação
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ToggleRow icon={Users} label="Exigir CPF" checked={localConfig.require_cpf} onChange={(v) => updateLocal({ require_cpf: v })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              Fidelidade e Promoções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <ToggleRow icon={Gift} label="Programa de fidelidade" checked={localConfig.loyalty_enabled} onChange={(v) => updateLocal({ loyalty_enabled: v })} />
            <ToggleRow icon={Tag} label="Cupons de desconto" checked={localConfig.coupons_enabled} onChange={(v) => updateLocal({ coupons_enabled: v })} />
            <ToggleRow icon={Percent} label="Promoções automáticas" checked={localConfig.promotions_enabled} onChange={(v) => updateLocal({ promotions_enabled: v })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              Timeout
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label className="text-xs">Segundos de inatividade</Label>
              <Input
                type="number"
                value={localConfig.inactivity_timeout_seconds}
                onChange={(e) => {
                  const val = Math.max(30, parseInt(e.target.value) || 120);
                  updateLocal({ inactivity_timeout_seconds: val });
                }}
                className="h-8 text-sm"
                min={30}
                max={600}
              />
              <p className="text-xs text-muted-foreground">
                {Math.floor(localConfig.inactivity_timeout_seconds / 60)}m {localConfig.inactivity_timeout_seconds % 60}s
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, checked, onChange,
}: {
  icon: any; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm">{label}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
