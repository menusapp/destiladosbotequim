import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OnlinePaymentsSettingsProps {
  restaurantId: string;
}

interface PaymentConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  provider: string;
  accept_pix: boolean;
  accept_card: boolean;
  enable_for_delivery: boolean;
  connection_status: string;
  mp_access_token: string | null;
  mp_public_key: string | null;
  connected_at: string | null;
}

type ViewState = "loading" | "not_connected" | "connected";

const OnlinePaymentsSettings = ({ restaurantId }: OnlinePaymentsSettingsProps) => {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [savingToggles, setSavingToggles] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Form fields for connecting MP
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("online_payment_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.mp_access_token && data.connection_status === "connected") {
        setConfig(data as unknown as PaymentConfig);
        setViewState("connected");
      } else if (data) {
        setConfig(data as unknown as PaymentConfig);
        setViewState("not_connected");
      } else {
        setConfig(null);
        setViewState("not_connected");
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      setViewState("not_connected");
    }
  };

  const handleConnect = async () => {
    if (!mpAccessToken || !mpPublicKey) {
      toast.error("Preencha o Access Token e a Public Key do Mercado Pago");
      return;
    }

    setSubmitting(true);
    try {
      const configData = {
        restaurant_id: restaurantId,
        provider: "mercadopago",
        mp_access_token: mpAccessToken,
        mp_public_key: mpPublicKey,
        connection_status: "connected",
        connected_at: new Date().toISOString(),
        enabled: false,
      };

      const { error } = await supabase
        .from("online_payment_config")
        .upsert(configData, { onConflict: "restaurant_id" });

      if (error) throw error;

      toast.success("Mercado Pago conectado com sucesso!");
      setMpAccessToken("");
      setMpPublicKey("");
      await fetchConfig();
    } catch (error: any) {
      console.error("Error connecting MP:", error);
      toast.error(error.message || "Erro ao conectar Mercado Pago");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (field: string, value: boolean) => {
    if (!config) return;

    setSavingToggles(true);
    try {
      const updateData: Record<string, unknown> = { [field]: value };

      if (field === "enable_for_delivery" && value) {
        updateData.enabled = true;
      }

      const { error } = await supabase
        .from("online_payment_config")
        .update(updateData)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      setConfig({ ...config, [field]: value, ...(field === "enable_for_delivery" && value ? { enabled: true } : {}) });
      toast.success("Configuração atualizada!");
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Erro ao atualizar configuração");
    } finally {
      setSavingToggles(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Mercado Pago? Você precisará reconectar para voltar a receber pagamentos online.")) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("online_payment_config")
        .delete()
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      setConfig(null);
      setViewState("not_connected");
      toast.success("Mercado Pago desconectado.");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  if (viewState === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pagamentos Online</h2>
        <p className="text-muted-foreground">
          Receba pagamentos via Pix e Cartão de Crédito diretamente no delivery
        </p>
      </div>

      {viewState === "not_connected" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Conectar Mercado Pago
            </CardTitle>
            <CardDescription>
              Insira as credenciais do Mercado Pago para ativar pagamentos online
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Access Token *</Label>
              <Input
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                placeholder="APP_USR-..."
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Mercado Pago → Seu negócio → Configurações → Credenciais
              </p>
            </div>
            <div className="space-y-2">
              <Label>Public Key *</Label>
              <Input
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                placeholder="APP_USR-..."
              />
            </div>
            <Button
              onClick={handleConnect}
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Conectar Mercado Pago
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {viewState === "connected" && config && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Mercado Pago
              </CardTitle>
              <Badge variant="outline" className="border-green-500 text-green-600">
                Conectado
              </Badge>
            </div>
            <CardDescription>
              Sua conta do Mercado Pago está conectada e pronta para receber
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Toggle: Accept Pix */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="font-medium">Aceitar Pix</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba pagamentos instantâneos via QR Code Pix
                  </p>
                </div>
              </div>
              <Switch
                checked={config.accept_pix ?? true}
                onCheckedChange={(v) => handleToggle("accept_pix", v)}
                disabled={savingToggles}
              />
            </div>

            <Separator />

            {/* Toggle: Accept Card */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="font-medium">Aceitar Cartão de Crédito</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba pagamentos com cartão de crédito online
                  </p>
                </div>
              </div>
              <Switch
                checked={config.accept_card ?? true}
                onCheckedChange={(v) => handleToggle("accept_card", v)}
                disabled={savingToggles}
              />
            </div>

            <Separator />

            {/* Toggle: Enable for Delivery */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="font-medium">Ativar no Delivery</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostrar opções de pagamento online no checkout do delivery
                  </p>
                </div>
              </div>
              <Switch
                checked={config.enable_for_delivery ?? true}
                onCheckedChange={(v) => handleToggle("enable_for_delivery", v)}
                disabled={savingToggles}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <p><strong>Conectado em:</strong> {config.connected_at ? new Date(config.connected_at).toLocaleDateString("pt-BR") : "-"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive"
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desconectar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OnlinePaymentsSettings;
