import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Megaphone, Clock, History, Settings, Send, BarChart3, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CampaignsList } from "./marketing/CampaignsList";
import { CampaignForm } from "./marketing/CampaignForm";
import { ScheduledMessages } from "./marketing/ScheduledMessages";
import { MessageHistory } from "./marketing/MessageHistory";
import { TrackingTab } from "./marketing/TrackingTab";

interface MarketingTabProps {
  restaurantId: string;
  onNavigateToWhatsApp?: () => void;
}

export default function MarketingTab({ restaurantId, onNavigateToWhatsApp }: MarketingTabProps) {
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ campaigns: 0, scheduled: 0, sent: 0 });
  const [activeTab, setActiveTab] = useState("campaigns");
  const [trackingFormOpen, setTrackingFormOpen] = useState(false);
  const [trackingFormPrefill, setTrackingFormPrefill] = useState<{
    triggerType: string;
    name?: string;
    messageTemplate?: string;
  } | undefined>(undefined);

  useEffect(() => {
    checkWhatsAppStatus();
    fetchStats();
  }, [restaurantId]);

  const checkWhatsAppStatus = async () => {
    try {
      // Leitura direta da config (a RLS de staff via x-app-token permite).
      // A RPC admin_get_whatsapp_status não é usada aqui porque no modelo de
      // sessão por token ela pode estar indisponível para o papel anon —
      // o que fazia este check falhar e mostrar o alerta vermelho mesmo com
      // o WhatsApp conectado.
      const { data, error } = await (supabase as any)
        .from("whatsapp_config")
        .select("enabled, instance_status")
        .eq("restaurant_id", restaurantId)
        .order("enabled", { ascending: false })
        .limit(1);

      if (error) throw error;

      const cfg = Array.isArray(data) ? data[0] : data;
      if (cfg) {
        const connected = cfg.instance_status === "connected" || cfg.instance_status === "open";
        // Instância conectada conta como pronto mesmo se o flag enabled ainda
        // não foi salvo (ele é auto-ligado na conexão a partir de agora).
        setWhatsappEnabled(cfg.enabled === true || connected);
        setWhatsappConnected(connected);
      } else {
        setWhatsappEnabled(false);
        setWhatsappConnected(false);
      }
    } catch (error) {
      console.error("Error checking WhatsApp status:", error);
      setWhatsappEnabled(false);
      setWhatsappConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [campaignsRes, scheduledRes, sentRes] = await Promise.all([
        supabase.from("marketing_campaigns").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("is_active", true),
        supabase.from("marketing_scheduled_messages").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("status", "pending"),
        supabase.from("marketing_scheduled_messages").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("status", "sent"),
      ]);
      setStats({
        campaigns: campaignsRes.count || 0,
        scheduled: scheduledRes.count || 0,
        sent: sentRes.count || 0,
      });
    } catch (e) { console.error(e); }
  };

  const handleCreateCampaignFromTracking = (triggerType: string) => {
    const templates: Record<string, { name: string; message: string }> = {
      abandoned_cart: {
        name: "Recuperação de Carrinho Abandonado",
        message: "Olá {nome}! 🛒\n\nNotamos que você deixou alguns itens no carrinho. Não perca essa oportunidade!\n\nUse o cupom {cupom} e garanta {desconto} de desconto!\n\nVálido por {validade} dias. Te esperamos! 😊",
      },
      inactive_customer: {
        name: "Reativação de Clientes Inativos",
        message: "Olá {nome}! 👋\n\nFaz tempo que não te vemos por aqui! Sentimos sua falta.\n\nUse o cupom {cupom} e ganhe {desconto} no seu próximo pedido!\n\nVálido por {validade} dias. Volte logo! 🍽️",
      },
      no_purchase: {
        name: "Primeira Compra",
        message: "Olá {nome}! 🎉\n\nVimos que você se cadastrou mas ainda não fez seu primeiro pedido.\n\nUse o cupom {cupom} e ganhe {desconto} na sua primeira compra!\n\nVálido por {validade} dias. Experimente! 😋",
      },
    };

    const template = templates[triggerType] || { name: "", message: "" };
    setTrackingFormPrefill({
      triggerType,
      name: template.name,
      messageTemplate: template.message,
    });
    setTrackingFormOpen(true);
  };

  const isWhatsAppReady = whatsappEnabled && whatsappConnected;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Marketing</h1>
        <p className="text-muted-foreground font-light">
          Crie campanhas automatizadas para engajar seus clientes via WhatsApp
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.campaigns}</p>
              <p className="text-xs text-muted-foreground">Campanhas ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.scheduled}</p>
              <p className="text-xs text-muted-foreground">Agendadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp warning */}
      {!isWhatsAppReady && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Para as campanhas funcionarem, o WhatsApp deve estar{" "}
              <strong>conectado</strong> na aba{" "}
              Configurações → Notificações WhatsApp
            </span>
            {onNavigateToWhatsApp && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToWhatsApp}
                className="ml-4 shrink-0"
              >
                <Settings className="h-4 w-4 mr-2" />
                Ir para Configurações
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-tour="marketing-tabs">
          <TabsTrigger value="campaigns" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            Agendadas
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2">
            <Target className="h-4 w-4" />
            Rastreamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignsList restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="scheduled">
          <ScheduledMessages restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="history">
          <MessageHistory restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="tracking">
          <TrackingTab
            restaurantId={restaurantId}
            onCreateCampaign={(triggerType) => handleCreateCampaignFromTracking(triggerType)}
          />
        </TabsContent>
      </Tabs>

      {/* Campaign Form opened from Tracking */}
      <CampaignForm
        restaurantId={restaurantId}
        open={trackingFormOpen}
        onOpenChange={(open) => {
          setTrackingFormOpen(open);
          if (!open) setTrackingFormPrefill(undefined);
        }}
        prefill={trackingFormPrefill}
        onSuccess={() => {
          setTrackingFormOpen(false);
          setTrackingFormPrefill(undefined);
          setActiveTab("campaigns");
          fetchStats();
        }}
      />
    </div>
  );
}
