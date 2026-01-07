import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { paymentService, PaymentConfig } from "@/services/paymentService";
import { 
  CreditCard, 
  Wifi, 
  WifiOff, 
  Loader2,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Smartphone,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface OnlinePaymentsSettingsProps {
  restaurantId: string;
}

const OnlinePaymentsSettings = ({ restaurantId }: OnlinePaymentsSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  
  // Configurações locais
  const [enabled, setEnabled] = useState(false);
  const [requirePrepayment, setRequirePrepayment] = useState(false);
  const [acceptPix, setAcceptPix] = useState(true);
  const [acceptCard, setAcceptCard] = useState(true);
  const [enableForDelivery, setEnableForDelivery] = useState(true);

  // Buscar configuração
  const fetchConfig = useCallback(async () => {
    try {
      const data = await paymentService.getConfig(restaurantId);
      
      if (data) {
        setConfig(data);
        setEnabled(data.enabled);
        setRequirePrepayment(data.requirePrepayment);
        setAcceptPix(data.acceptPix);
        setAcceptCard(data.acceptCard);
        setEnableForDelivery(data.enableForDelivery);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchConfig();
    
    // Verificar se retornou do OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    
    if (oauthStatus === 'success') {
      toast({
        title: "Conectado!",
        description: "Sua conta Mercado Pago foi conectada com sucesso."
      });
      // Limpar parâmetro da URL
      window.history.replaceState({}, '', window.location.pathname);
      fetchConfig();
    } else if (oauthStatus === 'error') {
      const errorMsg = urlParams.get('error') || 'Falha ao conectar';
      toast({
        title: "Erro na conexão",
        description: errorMsg,
        variant: "destructive"
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchConfig, toast]);

  // Conectar com Mercado Pago
  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      const result = await paymentService.startOAuth(restaurantId);
      
      if (result.authUrl) {
        // Redirecionar para o Mercado Pago
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.error || 'Falha ao iniciar conexão');
      }
    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao conectar com Mercado Pago",
        variant: "destructive"
      });
      setConnecting(false);
    }
  };

  // Desconectar
  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar sua conta Mercado Pago?')) return;
    
    try {
      const success = await paymentService.disconnect(restaurantId);
      
      if (success) {
        setConfig(prev => prev ? { 
          ...prev, 
          connectionStatus: 'disconnected',
          connectedAt: undefined
        } : null);
        setEnabled(false);
        
        toast({
          title: "Desconectado",
          description: "Conta Mercado Pago desconectada com sucesso"
        });
      } else {
        throw new Error('Falha ao desconectar');
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

  // Salvar configurações
  const handleSave = async () => {
    setSaving(true);
    
    try {
      const success = await paymentService.updateConfig(restaurantId, {
        enabled,
        requirePrepayment,
        acceptPix,
        acceptCard,
        enableForDelivery
      });
      
      if (success) {
        toast({
          title: "Salvo",
          description: "Configurações salvas com sucesso"
        });
        await fetchConfig();
      } else {
        throw new Error('Falha ao salvar');
      }
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

  const isConnected = config?.connectionStatus === 'connected';

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
          Receba pagamentos online diretamente na sua conta Mercado Pago
        </p>
      </div>

      {/* Card de Conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Mercado Pago
          </CardTitle>
          <CardDescription>
            Conecte sua conta para receber pagamentos via Pix e Cartão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status da Conexão */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-green-600">Conectado</span>
                      <Badge variant="secondary" className="gap-1">
                        <Smartphone className="h-3 w-3" />
                        Mercado Pago
                      </Badge>
                    </div>
                    {config?.connectedAt && (
                      <span className="text-sm text-muted-foreground">
                        Conectado em {new Date(config.connectedAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Não conectado</span>
                    <p className="text-sm text-muted-foreground">
                      Conecte sua conta para começar a receber pagamentos
                    </p>
                  </div>
                </>
              )}
            </div>

            <div>
              {isConnected ? (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDisconnect}
                >
                  Desconectar
                </Button>
              ) : (
                <Button 
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-[#009ee3] hover:bg-[#007eb5] text-white gap-2"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Conectar com Mercado Pago
                </Button>
              )}
            </div>
          </div>

          {/* Informação de segurança */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Seus dados de pagamento são processados diretamente pelo Mercado Pago. 
              Não armazenamos dados de cartão ou credenciais sensíveis.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Configurações (só aparece quando conectado) */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Personalize como os pagamentos online funcionam no seu estabelecimento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Ativar pagamento online */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="text-base">
                  Ativar pagamento online no delivery
                </Label>
                <p className="text-sm text-muted-foreground">
                  Clientes poderão pagar online ao fazer pedidos
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <Separator />

            {/* Exigir pagamento antecipado */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="prepayment" className="text-base">
                  Exigir pagamento antecipado
                </Label>
                <p className="text-sm text-muted-foreground">
                  Pedidos só serão confirmados após pagamento aprovado
                </p>
              </div>
              <Switch
                id="prepayment"
                checked={requirePrepayment}
                onCheckedChange={setRequirePrepayment}
                disabled={!enabled}
              />
            </div>

            <Separator />

            {/* Métodos de pagamento */}
            <div className="space-y-4">
              <Label className="text-base">Métodos aceitos</Label>
              
              <div className="flex items-center justify-between pl-4">
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Pix</span>
                    <p className="text-sm text-muted-foreground">
                      Pagamento instantâneo via QR Code
                    </p>
                  </div>
                </div>
                <Switch
                  checked={acceptPix}
                  onCheckedChange={setAcceptPix}
                  disabled={!enabled}
                />
              </div>

              <div className="flex items-center justify-between pl-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Cartão de crédito</span>
                    <p className="text-sm text-muted-foreground">
                      Visa, Mastercard, Elo e outros
                    </p>
                  </div>
                </div>
                <Switch
                  checked={acceptCard}
                  onCheckedChange={setAcceptCard}
                  disabled={!enabled}
                />
              </div>
            </div>

            <Separator />

            {/* Botão Salvar */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Configurações'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card informativo quando não conectado */}
      {!isConnected && (
        <Card className="border-dashed">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Comece a receber pagamentos online</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Conecte sua conta Mercado Pago e ofereça mais conveniência aos seus clientes 
                  com pagamentos via Pix e cartão de crédito.
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Sem mensalidade</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Receba direto na sua conta</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Pix instantâneo</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OnlinePaymentsSettings;
