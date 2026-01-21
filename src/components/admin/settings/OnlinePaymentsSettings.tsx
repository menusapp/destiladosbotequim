import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { paymentService, PaymentConfig } from "@/services/paymentService";
import { 
  CreditCard, 
  WifiOff, 
  Loader2,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Smartphone,
  AlertCircle,
  Key,
  ChevronDown,
  ChevronUp
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
  
  // Conexão manual
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [manualAccessToken, setManualAccessToken] = useState("");
  const [savingManual, setSavingManual] = useState(false);

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
      const errorCode = urlParams.get('error') || 'unknown';
      const errorMessages: Record<string, string> = {
        'missing_params': 'Parâmetros de autenticação ausentes. Tente novamente.',
        'config_error': 'Configuração do Mercado Pago não encontrada. Contate o suporte.',
        'token_exchange_failed': 'Falha ao obter token do Mercado Pago. A aplicação pode não estar pronta.',
        'database_error': 'Erro ao salvar credenciais. Tente novamente.',
        'server_error': 'Erro interno do servidor. Tente novamente.',
        'unknown': 'Erro desconhecido ao conectar. Tente a conexão manual.'
      };
      
      toast({
        title: "Erro na conexão OAuth",
        description: errorMessages[errorCode] || errorMessages['unknown'],
        variant: "destructive"
      });
      window.history.replaceState({}, '', window.location.pathname);
      // Mostrar opção manual automaticamente após erro OAuth
      setShowManualConnect(true);
    }
  }, [fetchConfig, toast]);

  // Conectar com Mercado Pago via OAuth
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
      const errorMessage = error instanceof Error ? error.message : "Falha ao conectar com Mercado Pago";
      toast({
        title: "Erro",
        description: `${errorMessage}. Tente a conexão manual abaixo.`,
        variant: "destructive"
      });
      setConnecting(false);
      setShowManualConnect(true);
    }
  };

  // Conectar manualmente com Access Token
  const handleManualConnect = async () => {
    if (!manualAccessToken.trim()) {
      toast({
        title: "Token vazio",
        description: "Cole o Access Token do Mercado Pago",
        variant: "destructive"
      });
      return;
    }
    
    setSavingManual(true);
    
    try {
      const result = await paymentService.connectManually(restaurantId, manualAccessToken.trim());
      
      if (result.success) {
        toast({
          title: "Conectado!",
          description: "Access Token configurado com sucesso"
        });
        setManualAccessToken("");
        setShowManualConnect(false);
        await fetchConfig();
      } else {
        throw new Error(result.error || 'Token inválido');
      }
    } catch (error) {
      console.error('Error manual connect:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Token inválido ou expirado",
        variant: "destructive"
      });
    } finally {
      setSavingManual(false);
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

          {/* Conexão Manual - Alternativa ao OAuth */}
          {!isConnected && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowManualConnect(!showManualConnect)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Key className="h-4 w-4" />
                <span>Conexão manual com Access Token</span>
                {showManualConnect ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {showManualConnect && (
                <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Se o botão acima não funcionar, você pode conectar manualmente usando seu Access Token do Mercado Pago.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      type="password"
                      placeholder="APP_USR-..."
                      value={manualAccessToken}
                      onChange={(e) => setManualAccessToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Encontre em: Mercado Pago → Seu negócio → Configurações → Gestão e Administração → Credenciais
                    </p>
                  </div>
                  <Button 
                    onClick={handleManualConnect}
                    disabled={savingManual || !manualAccessToken.trim()}
                    size="sm"
                    className="gap-2"
                  >
                    {savingManual ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                    Conectar com Token
                  </Button>
                </div>
              )}
            </div>
          )}

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
