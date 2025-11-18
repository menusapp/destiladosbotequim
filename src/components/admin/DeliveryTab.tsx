import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Truck, MessageSquare, Settings, Ticket, Gift, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CouponsManagement from "./CouponsManagement";
import LoyaltyManagement from "./LoyaltyManagement";

interface DeliveryTabProps {
  restaurantId: string;
}

export default function DeliveryTab({ restaurantId }: DeliveryTabProps) {
  const [whatsappConfig, setWhatsappConfig] = useState({
    enabled: false,
    apiToken: "",
    phoneNumber: "",
    messageAccepted: "Seu pedido foi aceito e está em preparo! 🍔",
    messageOutForDelivery: "Seu pedido saiu para entrega! 🚚",
    messageDelivered: "Seu pedido foi entregue! Obrigado pela preferência! 🙏",
  });

  const [deliveryConfig, setDeliveryConfig] = useState({
    minOrderValue: 0,
    deliveryFee: 0,
    estimatedTime: 30,
  });

  const [loading, setLoading] = useState(true);
  const [restaurantSlug, setRestaurantSlug] = useState("");

  useEffect(() => {
    fetchConfigs();
  }, [restaurantId]);

  const fetchConfigs = async () => {
    try {
      // Fetch restaurant slug
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("slug")
        .eq("id", restaurantId)
        .single();

      if (restaurantData) {
        setRestaurantSlug(restaurantData.slug);
      }

      // Fetch WhatsApp config
      const { data: whatsappData } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (whatsappData) {
        setWhatsappConfig({
          enabled: whatsappData.enabled || false,
          apiToken: whatsappData.api_token || "",
          phoneNumber: whatsappData.phone_number || "",
          messageAccepted: whatsappData.message_accepted || "Seu pedido foi aceito e está em preparo! 🍔",
          messageOutForDelivery: whatsappData.message_out_for_delivery || "Seu pedido saiu para entrega! 🚚",
          messageDelivered: whatsappData.message_delivered || "Seu pedido foi entregue! Obrigado pela preferência! 🙏",
        });
      }

      // Fetch Delivery config
      const { data: deliveryData } = await supabase
        .from("delivery_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (deliveryData) {
        setDeliveryConfig({
          minOrderValue: parseFloat(String(deliveryData.min_order_value)) || 0,
          deliveryFee: parseFloat(String(deliveryData.delivery_fee)) || 0,
          estimatedTime: deliveryData.estimated_time_minutes || 30,
        });
      }
    } catch (error) {
      console.error("Error fetching configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    try {
      const { data: existing } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      const payload = {
        restaurant_id: restaurantId,
        enabled: whatsappConfig.enabled,
        api_token: whatsappConfig.apiToken,
        phone_number: whatsappConfig.phoneNumber,
        message_accepted: whatsappConfig.messageAccepted,
        message_out_for_delivery: whatsappConfig.messageOutForDelivery,
        message_delivered: whatsappConfig.messageDelivered,
      };

      if (existing) {
        await supabase
          .from("whatsapp_config")
          .update(payload)
          .eq("restaurant_id", restaurantId);
      } else {
        await supabase.from("whatsapp_config").insert(payload);
      }

      toast.success("Configurações de WhatsApp salvas!");
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      toast.error("Erro ao salvar configurações");
    }
  };

  const handleSaveDelivery = async () => {
    try {
      const { data: existing } = await supabase
        .from("delivery_config")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      const payload = {
        restaurant_id: restaurantId,
        min_order_value: deliveryConfig.minOrderValue,
        delivery_fee: deliveryConfig.deliveryFee,
        estimated_time_minutes: deliveryConfig.estimatedTime,
      };

      if (existing) {
        await supabase
          .from("delivery_config")
          .update(payload)
          .eq("restaurant_id", restaurantId);
      } else {
        await supabase.from("delivery_config").insert(payload);
      }

      toast.success("Configurações de delivery salvas!");
    } catch (error) {
      console.error("Error saving delivery config:", error);
      toast.error("Erro ao salvar configurações");
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/delivery/${restaurantSlug}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <Tabs defaultValue="config" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="config">
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </TabsTrigger>
        <TabsTrigger value="integrations">
          <MessageSquare className="h-4 w-4 mr-2" />
          Integrações
        </TabsTrigger>
        <TabsTrigger value="coupons">
          <Ticket className="h-4 w-4 mr-2" />
          Cupons
        </TabsTrigger>
        <TabsTrigger value="loyalty">
          <Gift className="h-4 w-4 mr-2" />
          Fidelidade
        </TabsTrigger>
      </TabsList>

      <TabsContent value="config" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Configurações de Delivery
            </CardTitle>
            <CardDescription>
              Configure taxas, valores mínimos e tempo de entrega
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-link">Link do Cardápio Delivery</Label>
              <div className="flex gap-2">
                <Input
                  id="delivery-link"
                  value={`${window.location.origin}/delivery/${restaurantSlug}`}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={handleCopyLink} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este link com seus clientes para que eles possam fazer pedidos online
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-order">Valor Mínimo do Pedido (R$)</Label>
              <Input
                id="min-order"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={deliveryConfig.minOrderValue}
                onChange={(e) =>
                  setDeliveryConfig({ ...deliveryConfig, minOrderValue: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-fee">Taxa de Entrega (R$)</Label>
              <Input
                id="delivery-fee"
                type="number"
                step="0.01"
                placeholder="5.00"
                value={deliveryConfig.deliveryFee}
                onChange={(e) =>
                  setDeliveryConfig({ ...deliveryConfig, deliveryFee: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-time">Tempo Estimado de Entrega (min)</Label>
              <Input
                id="delivery-time"
                type="number"
                placeholder="30"
                value={deliveryConfig.estimatedTime}
                onChange={(e) =>
                  setDeliveryConfig({ ...deliveryConfig, estimatedTime: parseInt(e.target.value) || 30 })
                }
              />
            </div>

            <Button onClick={handleSaveDelivery} className="w-full">
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Integração WhatsApp
            </CardTitle>
            <CardDescription>
              Configure mensagens automáticas para clientes do delivery
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp-enabled">Ativar WhatsApp Automático</Label>
              <Switch
                id="whatsapp-enabled"
                checked={whatsappConfig.enabled}
                onCheckedChange={(checked) =>
                  setWhatsappConfig({ ...whatsappConfig, enabled: checked })
                }
              />
            </div>

            {whatsappConfig.enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="api-token">Token da API</Label>
                  <Input
                    id="api-token"
                    type="password"
                    placeholder="Seu token de API do WhatsApp Business"
                    value={whatsappConfig.apiToken}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, apiToken: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Configure sua API do WhatsApp Business para envio automático
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-number">Número do WhatsApp</Label>
                  <Input
                    id="phone-number"
                    placeholder="5511999999999"
                    value={whatsappConfig.phoneNumber}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, phoneNumber: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Mensagens Personalizadas</h4>

                  <div className="space-y-2">
                    <Label htmlFor="msg-accepted">Pedido Aceito</Label>
                    <Input
                      id="msg-accepted"
                      value={whatsappConfig.messageAccepted}
                      onChange={(e) =>
                        setWhatsappConfig({ ...whatsappConfig, messageAccepted: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="msg-out">Saiu para Entrega</Label>
                    <Input
                      id="msg-out"
                      value={whatsappConfig.messageOutForDelivery}
                      onChange={(e) =>
                        setWhatsappConfig({
                          ...whatsappConfig,
                          messageOutForDelivery: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="msg-delivered">Pedido Entregue</Label>
                    <Input
                      id="msg-delivered"
                      value={whatsappConfig.messageDelivered}
                      onChange={(e) =>
                        setWhatsappConfig({ ...whatsappConfig, messageDelivered: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleSaveWhatsApp} className="w-full">
                  Salvar Configurações WhatsApp
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="coupons">
        <CouponsManagement restaurantId={restaurantId} />
      </TabsContent>

      <TabsContent value="loyalty">
        <LoyaltyManagement restaurantId={restaurantId} />
      </TabsContent>
    </Tabs>
  );
}
