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
    console.log("[KioskSettings] Salvando configurações:", JSON.stringify(localConfig));
    setSaving(true);
    try {
      const payload = { ...localConfig, updated_at: new Date().toISOString() };
      delete (payload as any).id;
      console.log("[KioskSettings] Payload para upsert:", JSON.stringify(payload));
      const { error } = await supabase
        .from("kiosk_config")
        .update(payload)
        .eq("id", config.id);
      if (error) throw error;
      setConfig({ ...localConfig });
      setHasChanges(false);
      console.log("[KioskSettings] Configurações salvas com sucesso");
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
    <div className="space-y-6 max-w-3xl">
      {/* Save button sticky */}
      {hasChanges && (
        <div className="sticky top-0 z-10 bg-card border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Você tem alterações não salvas</span>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      )}

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
              <Badge variant={localConfig.enabled ? "default" : "secondary"}>
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

      {/* Link do Totem */}
      {localConfig.enabled && kioskUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              Link do Totem
            </CardTitle>
            <CardDescription>Use este link no navegador do totem/tablet</CardDescription>
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
          <ToggleRow icon={UtensilsCrossed} label="Comer no local" description="Cliente consome no estabelecimento" checked={localConfig.order_dine_in} onChange={(v) => updateLocal({ order_dine_in: v })} />
          <Separator />
          <ToggleRow icon={ShoppingBag} label="Para viagem" description="Cliente retira e leva" checked={localConfig.order_takeaway} onChange={(v) => updateLocal({ order_takeaway: v })} />
          <Separator />
          <ToggleRow icon={Store} label="Retirada no balcão" description="Cliente retira no balcão" checked={localConfig.order_pickup} onChange={(v) => updateLocal({ order_pickup: v })} />
          <Separator />
          <ToggleRow icon={Truck} label="Entrega" description="Pedido para entrega (quando disponível)" checked={localConfig.order_delivery} onChange={(v) => updateLocal({ order_delivery: v })} />
        </CardContent>
      </Card>

      {/* Formas de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
          <CardDescription>Meios de pagamento aceitos no totem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow icon={Banknote} label="Dinheiro" description="Pagamento em espécie com cálculo de troco" checked={localConfig.payment_cash} onChange={(v) => updateLocal({ payment_cash: v })} />
          <Separator />
          <ToggleRow icon={CreditCard} label="Cartão na maquininha" description="Pagamento na maquininha ao lado do totem" checked={localConfig.payment_card} onChange={(v) => updateLocal({ payment_card: v })} />
          <Separator />
          <ToggleRow icon={QrCode} label="PIX" description="Pagamento via QR Code PIX" checked={localConfig.payment_pix} onChange={(v) => updateLocal({ payment_pix: v })} />
          <Separator />
          <ToggleRow icon={Smartphone} label="Pagamento online" description="Cartão online integrado (futura integração)" checked={localConfig.payment_online} onChange={(v) => updateLocal({ payment_online: v })} />
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
          <ToggleRow icon={Users} label="Exigir CPF" description="Obrigar identificação por CPF antes do pedido" checked={localConfig.require_cpf} onChange={(v) => updateLocal({ require_cpf: v })} />
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
          <ToggleRow icon={Gift} label="Programa de fidelidade" description="Acumular e resgatar pontos no totem" checked={localConfig.loyalty_enabled} onChange={(v) => updateLocal({ loyalty_enabled: v })} />
          <Separator />
          <ToggleRow icon={Tag} label="Cupons de desconto" description="Permitir aplicar cupons no totem" checked={localConfig.coupons_enabled} onChange={(v) => updateLocal({ coupons_enabled: v })} />
          <Separator />
          <ToggleRow icon={Percent} label="Promoções automáticas" description="Exibir descontos e promoções vigentes" checked={localConfig.promotions_enabled} onChange={(v) => updateLocal({ promotions_enabled: v })} />
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
              value={localConfig.inactivity_timeout_seconds}
              onChange={(e) => {
                const val = Math.max(30, parseInt(e.target.value) || 120);
                updateLocal({ inactivity_timeout_seconds: val });
              }}
              className="w-24"
              min={30}
              max={600}
            />
            <span className="text-sm text-muted-foreground">
              ({Math.floor(localConfig.inactivity_timeout_seconds / 60)}m {localConfig.inactivity_timeout_seconds % 60}s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save button */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="lg" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, description, checked, onChange,
}: {
  icon: any; label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
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
