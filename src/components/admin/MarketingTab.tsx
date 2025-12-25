import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Megaphone, Clock, History, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CampaignsList } from "./marketing/CampaignsList";
import { ScheduledMessages } from "./marketing/ScheduledMessages";
import { MessageHistory } from "./marketing/MessageHistory";

interface MarketingTabProps {
  restaurantId: string;
  onNavigateToWhatsApp?: () => void;
}

export default function MarketingTab({ restaurantId, onNavigateToWhatsApp }: MarketingTabProps) {
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWhatsAppStatus();
  }, [restaurantId]);

  const checkWhatsAppStatus = async () => {
    try {
      const { data } = await supabase
        .from("whatsapp_config")
        .select("enabled, instance_status")
        .eq("restaurant_id", restaurantId)
        .single();

      if (data) {
        setWhatsappEnabled(data.enabled || false);
        setWhatsappConnected(data.instance_status === "open");
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
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-muted-foreground">
          Crie campanhas automatizadas para engajar seus clientes via WhatsApp
        </p>
      </div>

      {/* Aviso de dependência do WhatsApp */}
      {!isWhatsAppReady && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Para as campanhas funcionarem, o WhatsApp deve estar{" "}
              <strong>conectado</strong> e com{" "}
              <strong>mensagens automáticas ativadas</strong> em{" "}
              Configurações → Automação WhatsApp
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

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            Mensagens Agendadas
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
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
      </Tabs>
    </div>
  );
}
