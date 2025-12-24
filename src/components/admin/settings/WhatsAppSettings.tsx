import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { 
  MessageSquare, 
  Wifi, 
  WifiOff, 
  QrCode, 
  RefreshCw, 
  Loader2,
  CheckCircle2,
  Smartphone,
  Send
} from "lucide-react";

interface WhatsAppConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  instance_name: string | null;
  instance_status: string | null;
  connected_phone: string | null;
  connected_at: string | null;
  message_accepted: string | null;
  message_out_for_delivery: string | null;
  message_delivered: string | null;
  message_ready_for_pickup: string | null;
  message_picked_up: string | null;
  message_cancelled: string | null;
}

const DEFAULT_MESSAGES = {
  accepted: "✅ Olá {nome}! Seu pedido #{pedido} foi aceito e está sendo preparado. Tempo estimado: {tempo} minutos.",
  out_for_delivery: "🚗 Seu pedido #{pedido} saiu para entrega! Em breve chegará no seu endereço.",
  delivered: "🎉 Pedido #{pedido} entregue com sucesso! Obrigado pela preferência, {nome}!",
  ready_for_pickup: "📍 Seu pedido #{pedido} está pronto para retirada! Aguardamos você!",
  picked_up: "✅ Pedido #{pedido} retirado com sucesso! Obrigado pela preferência, {nome}! 🙏",
  cancelled: "❌ Olá {nome}, infelizmente seu pedido #{pedido} foi cancelado. Entre em contato conosco para mais informações."
};

const SUPABASE_URL = "https://nrddbsudiphrvgfneqle.supabase.co";

const WhatsAppSettings = ({ restaurantId }: { restaurantId: string }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectFlowActive, setConnectFlowActive] = useState(false); // Controls QR area visibility
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState({
    accepted: DEFAULT_MESSAGES.accepted,
    out_for_delivery: DEFAULT_MESSAGES.out_for_delivery,
    delivered: DEFAULT_MESSAGES.delivered,
    ready_for_pickup: DEFAULT_MESSAGES.ready_for_pickup,
    picked_up: DEFAULT_MESSAGES.picked_up,
    cancelled: DEFAULT_MESSAGES.cancelled
  });
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate QR code image from string
  const generateQrImage = async (qrString: string): Promise<string | null> => {
    try {
      if (qrString.startsWith('data:image')) {
        return qrString;
      }
      if (qrString.length > 500 && !qrString.includes(' ')) {
        return `data:image/png;base64,${qrString}`;
      }
      const dataUrl = await QRCode.toDataURL(qrString, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      return dataUrl;
    } catch (error) {
      console.error('Error generating QR image:', error);
      return null;
    }
  };

  // Stop all polling
  const stopAllPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (qrPollIntervalRef.current) {
      clearInterval(qrPollIntervalRef.current);
      qrPollIntervalRef.current = null;
    }
    if (qrPollTimeoutRef.current) {
      clearTimeout(qrPollTimeoutRef.current);
      qrPollTimeoutRef.current = null;
    }
  }, []);

  // Fetch config on mount
  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setEnabled(data.enabled || false);
        setMessages({
          accepted: data.message_accepted || DEFAULT_MESSAGES.accepted,
          out_for_delivery: data.message_out_for_delivery || DEFAULT_MESSAGES.out_for_delivery,
          delivered: data.message_delivered || DEFAULT_MESSAGES.delivered,
          ready_for_pickup: data.message_ready_for_pickup || DEFAULT_MESSAGES.ready_for_pickup,
          picked_up: data.message_picked_up || DEFAULT_MESSAGES.picked_up,
          cancelled: data.message_cancelled || DEFAULT_MESSAGES.cancelled
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchConfig();
    return () => {
      stopAllPolling();
    };
  }, [fetchConfig, stopAllPolling]);

  // Check instance status
  const checkStatus = async (): Promise<{ status: string } | null> => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-instance?restaurantId=${restaurantId}`
      );
      const data = await response.json();
      
      if (data.status === 'connected') {
        setConfig(prev => prev ? { ...prev, instance_status: 'connected' } : null);
        setQrCodeDataUrl(null);
        setConnectFlowActive(false);
        stopAllPolling();
      } else if (data.status === 'disconnected' || data.status === 'not_created') {
        setConfig(prev => prev ? { ...prev, instance_status: data.status } : null);
      }
      
      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      return null;
    }
  };

  // Poll for QR code if not received initially
  const pollForQrCode = useCallback(async () => {
    if (!connectFlowActive) return;
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-instance?restaurantId=${restaurantId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'qrcode' })
        }
      );
      
      const data = await response.json();
      
      if (data.qrString) {
        const imageUrl = await generateQrImage(data.qrString);
        if (imageUrl) {
          setQrCodeDataUrl(imageUrl);
          if (qrPollIntervalRef.current) {
            clearInterval(qrPollIntervalRef.current);
            qrPollIntervalRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error('Error polling for QR:', error);
    }
  }, [restaurantId, connectFlowActive]);

  // Create instance and get QR code
  const handleConnect = async () => {
    setConnecting(true);
    setConnectFlowActive(true);
    setQrCodeDataUrl(null);
    stopAllPolling();
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-instance?restaurantId=${restaurantId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create' })
        }
      );
      
      const data = await response.json();
      console.log('Connect response:', data);
      
      if (data.qrString) {
        const imageUrl = await generateQrImage(data.qrString);
        if (imageUrl) {
          setQrCodeDataUrl(imageUrl);
          setConfig(prev => prev ? { 
            ...prev, 
            instance_name: data.instance_name,
            instance_status: 'pending' 
          } : null);
          
          toast({
            title: "QR Code gerado",
            description: "Escaneie o código com seu WhatsApp para conectar"
          });
        } else {
          throw new Error('Falha ao gerar imagem do QR code');
        }
      } else if (data.status === 'pending_qr') {
        setConfig(prev => prev ? { 
          ...prev, 
          instance_name: data.instance_name,
          instance_status: 'pending' 
        } : null);
        
        toast({
          title: "Aguardando QR Code",
          description: "O QR code está sendo gerado..."
        });
        
        // Poll for QR code every 3 seconds
        qrPollIntervalRef.current = setInterval(pollForQrCode, 3000);
        
        // Stop QR polling after 60 seconds with feedback
        qrPollTimeoutRef.current = setTimeout(() => {
          if (qrPollIntervalRef.current) {
            clearInterval(qrPollIntervalRef.current);
            qrPollIntervalRef.current = null;
          }
          if (!qrCodeDataUrl) {
            toast({
              title: "Tempo esgotado",
              description: "Não foi possível obter o QR Code. Clique em 'Tentar novamente'.",
              variant: "destructive"
            });
          }
        }, 60000);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Resposta inesperada do servidor');
      }

      // Start polling for connection status
      pollIntervalRef.current = setInterval(async () => {
        const status = await checkStatus();
        if (status?.status === 'connected') {
          toast({
            title: "Conectado!",
            description: "WhatsApp conectado com sucesso"
          });
        }
      }, 3000);

      // Stop status polling after 2 minutes
      setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }, 120000);
      
    } catch (error) {
      console.error('Error connecting:', error);
      setConnectFlowActive(false);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao conectar WhatsApp",
        variant: "destructive"
      });
    } finally {
      setConnecting(false);
    }
  };

  // Cancel connection flow
  const handleCancelConnect = () => {
    stopAllPolling();
    setConnectFlowActive(false);
    setQrCodeDataUrl(null);
  };

  // Disconnect instance
  const handleDisconnect = async () => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-instance?restaurantId=${restaurantId}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setConfig(prev => prev ? { 
          ...prev, 
          instance_status: 'disconnected',
          connected_phone: null,
          connected_at: null
        } : null);
        setQrCodeDataUrl(null);
        setConnectFlowActive(false);
        stopAllPolling();
        
        toast({
          title: "Desconectado",
          description: "WhatsApp desconectado com sucesso"
        });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Erro",
        description: "Falha ao desconectar",
        variant: "destructive"
      });
    }
  };

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_config')
        .upsert({
          restaurant_id: restaurantId,
          enabled,
          message_accepted: messages.accepted,
          message_out_for_delivery: messages.out_for_delivery,
          message_delivered: messages.delivered,
          message_ready_for_pickup: messages.ready_for_pickup,
          message_picked_up: messages.picked_up,
          message_cancelled: messages.cancelled,
          updated_at: new Date().toISOString()
        }, { onConflict: 'restaurant_id' });

      if (error) throw error;

      toast({
        title: "Salvo",
        description: "Configurações salvas com sucesso"
      });
      
      await fetchConfig();
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Send test message
  const handleTestMessage = async () => {
    const phone = prompt('Digite o número de telefone para teste (com DDD):');
    if (!phone) return;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId,
            phone,
            message: '🧪 Mensagem de teste do sistema Menus!',
            messageType: 'test'
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Enviado!",
          description: `Mensagem de teste enviada para ${phone}`
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error sending test:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem de teste",
        variant: "destructive"
      });
    }
  };

  const isConnected = config?.instance_status === 'connected';
  const isPending = config?.instance_status === 'pending';

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
        <h2 className="text-2xl font-bold">Automação WhatsApp</h2>
        <p className="text-muted-foreground">Configure notificações automáticas via WhatsApp</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-medium text-green-600">Conectado</span>
                  <Badge variant="secondary" className="gap-1">
                    <Smartphone className="h-3 w-3" />
                    {config?.connected_phone || 'WhatsApp Business'}
                  </Badge>
                </>
              ) : isPending ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="font-medium text-yellow-600">Aguardando conexão...</span>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <span className="font-medium text-muted-foreground">Desconectado</span>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {isConnected ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleTestMessage}>
                    <Send className="h-4 w-4 mr-2" />
                    Testar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                    <WifiOff className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  {connecting ? 'Gerando...' : 'Conectar WhatsApp'}
                </Button>
              )}
            </div>
          </div>

          {/* QR Code Display - Only show when user explicitly clicked Connect */}
          {connectFlowActive && !isConnected && (
            <div className="flex flex-col items-center gap-4 py-6 border rounded-lg bg-white">
              {qrCodeDataUrl ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR Code com seu WhatsApp
                  </p>
                  <img 
                    src={qrCodeDataUrl} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64"
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleConnect} disabled={connecting}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${connecting ? 'animate-spin' : ''}`} />
                      Gerar novo QR Code
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancelConnect}>
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Gerando QR Code...
                  </p>
                  <Button variant="outline" size="sm" onClick={handleCancelConnect} className="mt-2">
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable Automation */}
      <Card>
        <CardHeader>
          <CardTitle>Ativar Automação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enviar mensagens automáticas</Label>
              <p className="text-sm text-muted-foreground">
                Notificar clientes automaticamente sobre o status dos pedidos
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!isConnected}
            />
          </div>
          {!isConnected && (
            <p className="text-sm text-orange-600 mt-2">
              ⚠️ Conecte o WhatsApp primeiro para ativar a automação
            </p>
          )}
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates de Mensagens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>, 
            <code className="bg-muted px-1 rounded ml-1">{'{pedido}'}</code>, 
            <code className="bg-muted px-1 rounded ml-1">{'{tempo}'}</code>,
            <code className="bg-muted px-1 rounded ml-1">{'{endereco}'}</code>
          </p>

          {/* Delivery Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">📦 Entrega</h4>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Pedido Aceito
              </Label>
              <Textarea
                value={messages.accepted}
                onChange={(e) => setMessages(prev => ({ ...prev, accepted: e.target.value }))}
                rows={3}
                placeholder="Mensagem quando o pedido for aceito..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-blue-600" />
                Saiu para Entrega
              </Label>
              <Textarea
                value={messages.out_for_delivery}
                onChange={(e) => setMessages(prev => ({ ...prev, out_for_delivery: e.target.value }))}
                rows={3}
                placeholder="Mensagem quando sair para entrega..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                Pedido Entregue
              </Label>
              <Textarea
                value={messages.delivered}
                onChange={(e) => setMessages(prev => ({ ...prev, delivered: e.target.value }))}
                rows={3}
                placeholder="Mensagem quando o pedido for entregue..."
              />
            </div>
          </div>

          <Separator />

          {/* Pickup Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">🏪 Retirada</h4>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-orange-600" />
                Pronto para Retirada
              </Label>
              <Textarea
                value={messages.ready_for_pickup}
                onChange={(e) => setMessages(prev => ({ ...prev, ready_for_pickup: e.target.value }))}
                rows={3}
                placeholder="Mensagem quando o pedido estiver pronto para retirada..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Pedido Retirado
              </Label>
              <Textarea
                value={messages.picked_up}
                onChange={(e) => setMessages(prev => ({ ...prev, picked_up: e.target.value }))}
                rows={3}
                placeholder="Mensagem quando o cliente retirar o pedido..."
              />
            </div>
          </div>

          <Separator />

          {/* Cancellation Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">❌ Cancelamento</h4>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-600" />
                Pedido Cancelado
              </Label>
              <Textarea
                value={messages.cancelled}
                onChange={(e) => setMessages(prev => ({ ...prev, cancelled: e.target.value }))}
                rows={3}
                placeholder="Mensagem quando o pedido for cancelado..."
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppSettings;
