import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Loader2,
  Smartphone,
  AlertTriangle,
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
  accept_pix: boolean;
  accept_card: boolean;
  enable_for_delivery: boolean;
  connection_status: string;
  mp_access_token: string | null;
}

const OnlinePaymentsSettings = ({ restaurantId }: OnlinePaymentsSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [savingToggles, setSavingToggles] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

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
        setIsConnected(true);
      } else if (data) {
        setConfig(data as unknown as PaymentConfig);
        setIsConnected(false);
      } else {
        setConfig(null);
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field: string, value: boolean) => {
    if (!config) return;

    setSavingToggles(true);
    try {
      const { error } = await supabase.rpc("admin_upsert_payment_config", {
        p_restaurant_id: restaurantId,
        p_field: field,
        p_value: String(value),
      });
      if (error) throw error;

      if (field === "enable_for_delivery" && value) {
        await supabase.rpc("admin_upsert_payment_config", {
          p_restaurant_id: restaurantId,
          p_field: "enabled",
          p_value: "true",
        });
      }

      setConfig({ ...config, [field]: value, ...(field === "enable_for_delivery" && value ? { enabled: true } : {}) });
      toast.success("Configuração atualizada!");
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Erro ao atualizar configuração");
    } finally {
      setSavingToggles(false);
    }
  };

  if (loading) {
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

      {!isConnected && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                Conecte o Mercado Pago na aba <strong>Integrações</strong> para ativar pagamentos online.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opções de Pagamento</CardTitle>
            <CardDescription>
              Escolha quais formas de pagamento online aceitar
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OnlinePaymentsSettings;
