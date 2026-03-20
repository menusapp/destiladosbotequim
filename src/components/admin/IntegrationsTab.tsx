import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2, ExternalLink, Copy, CheckCircle2, XCircle, Plug, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;

interface IfoodConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  merchant_id: string | null;
  token_expires_at: string | null;
  access_token: string | null;
}

interface IntegrationsTabProps {
  restaurantId: string;
}

const IntegrationsTab = ({ restaurantId }: IntegrationsTabProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [config, setConfig] = useState<IfoodConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ifood_config")
      .select("id, restaurant_id, enabled, merchant_id, token_expires_at, access_token")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    setConfig(data as IfoodConfig | null);
    setLoading(false);
  };

  const isConnected = config?.access_token && config?.merchant_id;

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_code", restaurant_id: restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar código");
      setUserCode(data.userCode);
      setVerificationUrl(data.verificationUrlComplete || data.verificationUrl);
      toast.success("Código gerado! Siga as instruções abaixo.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleExchangeToken = async () => {
    if (!authCode.trim()) {
      toast.error("Cole o código de autorização do iFood");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exchange_token",
          restaurant_id: restaurantId,
          authorization_code: authCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao conectar");
      toast.success("iFood conectado com sucesso!");
      setUserCode(null);
      setAuthCode("");
      await fetchConfig();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", restaurant_id: restaurantId }),
      });
      if (!res.ok) throw new Error("Erro ao desconectar");
      toast.success("iFood desconectado");
      await fetchConfig();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    await supabase
      .from("ifood_config")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("restaurant_id", restaurantId);
    setConfig((prev) => (prev ? { ...prev, enabled } : null));
    toast.success(enabled ? "Recebimento de pedidos ativado" : "Recebimento de pedidos desativado");
  };

  const maskMerchantId = (id: string) =>
    id.length > 8 ? `${id.slice(0, 4)}****${id.slice(-4)}` : id;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte plataformas externas ao seu restaurante</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* iFood Card */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border"
          onClick={() => setSheetOpen(true)}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#EA1D2C]/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-[#EA1D2C]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">iFood</h3>
                  <p className="text-xs text-muted-foreground">Receba pedidos do iFood</p>
                </div>
              </div>
              {isConnected ? (
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Conectado</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Desconectado</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Direto — Em breve */}
        <Card className="opacity-60 cursor-not-allowed border">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Plug className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Delivery Direto</h3>
                  <p className="text-xs text-muted-foreground">Plataforma de delivery própria</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* iFood Config Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#EA1D2C]" />
              Configuração iFood
            </SheetTitle>
            <SheetDescription>
              Conecte sua loja iFood para receber pedidos automaticamente
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isConnected ? (
              /* Connected State */
              <div className="space-y-5">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Conectado ao iFood</span>
                </div>

                {config?.merchant_id && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Merchant ID</Label>
                    <p className="text-sm font-mono">{maskMerchantId(config.merchant_id)}</p>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Receber pedidos</Label>
                    <p className="text-xs text-muted-foreground">Ativar ou pausar o recebimento</p>
                  </div>
                  <Switch
                    checked={config?.enabled ?? false}
                    onCheckedChange={handleToggleEnabled}
                  />
                </div>

                <Separator />

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleDisconnect()}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Desconectar iFood
                </Button>
              </div>
            ) : (
              /* Not Connected State */
              <div className="space-y-5">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Como conectar:</h4>
                  <div className="space-y-2">
                    <div className="flex gap-3 items-start">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#EA1D2C] text-white text-xs flex items-center justify-center font-bold">1</span>
                      <p className="text-sm text-muted-foreground">Clique em "Gerar Código" abaixo para obter seu código de verificação</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#EA1D2C] text-white text-xs flex items-center justify-center font-bold">2</span>
                      <p className="text-sm text-muted-foreground">Acesse o Portal do Parceiro iFood e autorize o aplicativo com o código gerado</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#EA1D2C] text-white text-xs flex items-center justify-center font-bold">3</span>
                      <p className="text-sm text-muted-foreground">Copie o código de autorização retornado e cole abaixo</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {!userCode ? (
                  <Button
                    className="w-full bg-[#EA1D2C] hover:bg-[#c4161f]"
                    onClick={() => handleGenerateCode()}
                    disabled={generatingCode}
                  >
                    {generatingCode ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4 mr-2" />
                    )}
                    Gerar Código
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-muted border">
                      <Label className="text-xs text-muted-foreground">Seu código de verificação:</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-lg font-bold tracking-widest">{userCode}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            navigator.clipboard.writeText(userCode);
                            toast.success("Código copiado!");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {verificationUrl && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(verificationUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Portal iFood para autorizar
                      </Button>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-sm">Código de autorização do iFood:</Label>
                      <Input
                        placeholder="Cole aqui o código retornado pelo iFood"
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                      />
                      <Button
                        className="w-full bg-[#EA1D2C] hover:bg-[#c4161f]"
                        onClick={() => handleExchangeToken()}
                        disabled={connecting || !authCode.trim()}
                      >
                        {connecting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Conectar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default IntegrationsTab;
