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
  ExternalLink,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
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
  mp_sandbox_payer_email: string | null;
  connected_at: string | null;
}

type ViewState = "loading" | "not_connected" | "connected";

const OnlinePaymentsSettings = ({ restaurantId }: OnlinePaymentsSettingsProps) => {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [savingToggles, setSavingToggles] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [sandboxEmail, setSandboxEmail] = useState("");
  const [savingSandboxEmail, setSavingSandboxEmail] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      const { data: rows, error } = await supabase.rpc("admin_get_payment_config", {
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;
      const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (data && data.mp_access_token && data.connection_status === "connected") {
        setConfig(data as unknown as PaymentConfig);
        setViewState("connected");
        setSandboxEmail(data.mp_sandbox_payer_email || "");
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

  const handleStartOAuth = async () => {
    setStartingOAuth(true);
    try {
      // 1. Ensure a config row exists to use as state
      let configId = config?.id;
      if (!configId) {
        const { data: newConfig, error: upsertError } = await supabase
          .from("online_payment_config")
          .upsert(
            { restaurant_id: restaurantId, connection_status: "pending", provider: "mercadopago" },
            { onConflict: "restaurant_id" }
          )
          .select("id")
          .single();

        if (upsertError) throw upsertError;
        configId = newConfig.id;
      }

      // 2. Fetch client_id from edge function
      const { data, error } = await supabase.functions.invoke("mercadopago-oauth", {
        method: "GET",
      });

      if (error) throw error;
      if (!data?.client_id) throw new Error("client_id não disponível");

      // 3. Redirect to Mercado Pago authorization
      const redirectUri = `${window.location.origin}/admin/mercadopago/callback`;
      const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${data.client_id}&response_type=code&platform_id=mp&state=${configId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Error starting OAuth:", error);
      toast.error(error.message || "Erro ao iniciar conexão com Mercado Pago");
      setStartingOAuth(false);
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

  const handleSaveSandboxEmail = async () => {
    if (!config) return;
    setSavingSandboxEmail(true);
    try {
      const { error } = await supabase
        .from("online_payment_config")
        .update({ mp_sandbox_payer_email: sandboxEmail.trim() || null } as any)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      setConfig({ ...config, mp_sandbox_payer_email: sandboxEmail.trim() || null });
      toast.success("Email de teste salvo!");
    } catch (error) {
      console.error("Error saving sandbox email:", error);
      toast.error("Erro ao salvar email de teste");
    } finally {
      setSavingSandboxEmail(false);
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
              Conecte sua conta do Mercado Pago para ativar pagamentos online de forma segura via OAuth
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao clicar no botão abaixo, você será redirecionado para o Mercado Pago para autorizar a conexão. 
              Nenhuma credencial manual é necessária.
            </p>
            <Button
              onClick={handleStartOAuth}
              disabled={startingOAuth}
              className="w-full"
              size="lg"
            >
              {startingOAuth ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecionando...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Conectar com Mercado Pago
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

            {config.mp_access_token?.startsWith("TEST-") && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <Label className="font-medium">Email de teste (Sandbox)</Label>
                    <p className="text-sm text-muted-foreground">
                      Informe o email de um Test User válido do Mercado Pago. 
                      Crie em <a href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts" target="_blank" rel="noopener noreferrer" className="underline text-primary">Contas de teste</a>.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="test_user_123456@testuser.com"
                      value={sandboxEmail}
                      onChange={(e) => setSandboxEmail(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveSandboxEmail}
                      disabled={savingSandboxEmail}
                    >
                      {savingSandboxEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                  {!sandboxEmail.trim() && (
                    <p className="text-sm text-destructive">
                      ⚠️ Sem este email, pagamentos em modo teste serão rejeitados.
                    </p>
                  )}
                </div>
              </>
            )}

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
