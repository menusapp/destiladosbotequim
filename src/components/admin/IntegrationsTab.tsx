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
  Loader2, ExternalLink, Copy, CheckCircle2, XCircle, Plug, Truck, CreditCard, BarChart3,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface IfoodConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  merchant_id: string | null;
  token_expires_at: string | null;
  access_token: string | null;
}

interface DDConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  store_id: string | null;
  username: string | null;
  access_token: string | null;
  token_expires_at: string | null;
}

interface MpConfig {
  id: string;
  connection_status: string;
  mp_access_token: string | null;
  connected_at: string | null;
}

interface IntegrationsTabProps {
  restaurantId: string;
}

const IntegrationsTab = ({ restaurantId }: IntegrationsTabProps) => {
  // iFood state
  const [ifoodSheetOpen, setIfoodSheetOpen] = useState(false);
  const [ifoodConfig, setIfoodConfig] = useState<IfoodConfig | null>(null);
  const [ifoodLoading, setIfoodLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");

  // DD state
  const [ddSheetOpen, setDdSheetOpen] = useState(false);
  const [ddConfig, setDdConfig] = useState<DDConfig | null>(null);
  const [ddLoading, setDdLoading] = useState(true);
  const [ddConnecting, setDdConnecting] = useState(false);
  const [ddStoreId, setDdStoreId] = useState("");
  const [ddUsername, setDdUsername] = useState("");
  const [ddPassword, setDdPassword] = useState("");

  // Mercado Pago state
  const [mpSheetOpen, setMpSheetOpen] = useState(false);
  const [mpConfig, setMpConfig] = useState<MpConfig | null>(null);
  const [mpLoading, setMpLoading] = useState(true);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [disconnectingMp, setDisconnectingMp] = useState(false);

  // Facebook Pixel state
  const [fbPixelSheetOpen, setFbPixelSheetOpen] = useState(false);
  const [fbPixelId, setFbPixelId] = useState("");
  const [fbPixelSaved, setFbPixelSaved] = useState(false);
  const [fbPixelLoading, setFbPixelLoading] = useState(true);
  const [fbPixelSaving, setFbPixelSaving] = useState(false);

  useEffect(() => {
    fetchIfoodConfig();
    fetchDdConfig();
    fetchMpConfig();
    fetchFbPixel();
  }, [restaurantId]);

  const fetchIfoodConfig = async () => {
    setIfoodLoading(true);
    const { data } = await supabase
      .from("ifood_config" as any)
      .select("id, restaurant_id, enabled, merchant_id, token_expires_at, access_token")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    setIfoodConfig(data as unknown as IfoodConfig | null);
    setIfoodLoading(false);
  };

  const fetchDdConfig = async () => {
    setDdLoading(true);
    const { data } = await supabase
      .from("deliverydireto_config" as any)
      .select("id, restaurant_id, enabled, store_id, username, access_token, token_expires_at")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    setDdConfig(data as unknown as DDConfig | null);
    setDdLoading(false);
  };

  const fetchMpConfig = async () => {
    setMpLoading(true);
    try {
      const { data: rows, error } = await supabase.rpc("admin_get_payment_config", {
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (data && data.mp_access_token && data.connection_status === "connected") {
        setMpConfig(data as unknown as MpConfig);
      } else {
        setMpConfig(null);
      }
    } catch {
      setMpConfig(null);
    } finally {
      setMpLoading(false);
    }
  };

  const isIfoodConnected = ifoodConfig?.access_token && ifoodConfig?.merchant_id;
  const isDdConnected = ddConfig?.access_token && ddConfig?.store_id && ddConfig?.enabled;
  const isMpConnected = !!mpConfig;

  // === iFood handlers ===
  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
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
    if (!authCode.trim()) { toast.error("Cole o código de autorização do iFood"); return; }
    setConnecting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
        body: JSON.stringify({ action: "exchange_token", restaurant_id: restaurantId, authorization_code: authCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao conectar");
      toast.success("iFood conectado com sucesso!");
      setUserCode(null);
      setAuthCode("");
      await fetchIfoodConfig();
    } catch (err: any) { toast.error(err.message); }
    finally { setConnecting(false); }
  };

  const handleIfoodDisconnect = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
        body: JSON.stringify({ action: "disconnect", restaurant_id: restaurantId }),
      });
      if (!res.ok) throw new Error("Erro ao desconectar");
      toast.success("iFood desconectado");
      await fetchIfoodConfig();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleIfoodToggle = async (enabled: boolean) => {
    await supabase
      .from("ifood_config" as any)
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq("restaurant_id", restaurantId);
    setIfoodConfig((prev) => (prev ? { ...prev, enabled } : null));
    toast.success(enabled ? "Recebimento de pedidos ativado" : "Recebimento de pedidos desativado");
  };

  const maskId = (id: string) => id.length > 8 ? `${id.slice(0, 4)}****${id.slice(-4)}` : id;

  // === DD handlers ===
  const handleDdConnect = async () => {
    if (!ddStoreId.trim() || !ddUsername.trim() || !ddPassword.trim()) {
      toast.error("Preencha Store ID, Username e Password");
      return;
    }
    setDdConnecting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dd-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
        body: JSON.stringify({
          action: "connect",
          restaurant_id: restaurantId,
          store_id: ddStoreId.trim(),
          username: ddUsername.trim(),
          password: ddPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao conectar");
      toast.success("Delivery Direto conectado com sucesso!");
      setDdStoreId("");
      setDdUsername("");
      setDdPassword("");
      await fetchDdConfig();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDdConnecting(false);
    }
  };

  const handleDdDisconnect = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dd-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
        body: JSON.stringify({ action: "disconnect", restaurant_id: restaurantId }),
      });
      if (!res.ok) throw new Error("Erro ao desconectar");
      toast.success("Delivery Direto desconectado");
      await fetchDdConfig();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDdToggle = async (enabled: boolean) => {
    await supabase
      .from("deliverydireto_config" as any)
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq("restaurant_id", restaurantId);
    setDdConfig((prev) => (prev ? { ...prev, enabled } : null));
    toast.success(enabled ? "Recebimento de pedidos ativado" : "Recebimento de pedidos desativado");
  };

  // === Mercado Pago handlers ===
  const handleStartMpOAuth = async () => {
    setStartingOAuth(true);
    try {
      let configId = mpConfig?.id;
      if (!configId) {
        const { data: newId, error: ensureError } = await supabase.rpc("admin_ensure_payment_config", {
          p_restaurant_id: restaurantId,
        });
        if (ensureError) throw ensureError;
        configId = newId;
      }

      const { data, error } = await supabase.functions.invoke("mercadopago-oauth", {
        method: "GET",
      });
      if (error) throw error;
      if (!data?.client_id) throw new Error("client_id não disponível");

      const redirectUri = `${window.location.origin}/admin/mercadopago/callback`;
      const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${data.client_id}&response_type=code&platform_id=mp&state=${configId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Error starting MP OAuth:", error);
      toast.error(error.message || "Erro ao iniciar conexão com Mercado Pago");
      setStartingOAuth(false);
    }
  };

  const handleMpDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Mercado Pago? Você precisará reconectar para voltar a receber pagamentos online.")) return;
    setDisconnectingMp(true);
    try {
      const { error } = await supabase.rpc("admin_delete_payment_config", {
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      setMpConfig(null);
      toast.success("Mercado Pago desconectado.");
    } catch (error) {
      console.error("Error disconnecting MP:", error);
      toast.error("Erro ao desconectar");
    } finally {
      setDisconnectingMp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte plataformas externas ao seu restaurante</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* iFood Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow border" onClick={() => setIfoodSheetOpen(true)}>
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
              {isIfoodConnected ? (
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Conectado</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Desconectado</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Direto Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow border" onClick={() => setDdSheetOpen(true)}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#0066CC]/10 flex items-center justify-center">
                  <Plug className="h-5 w-5 text-[#0066CC]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Delivery Direto</h3>
                  <p className="text-xs text-muted-foreground">Plataforma de delivery própria</p>
                </div>
              </div>
              {isDdConnected ? (
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Conectado</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Desconectado</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mercado Pago Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow border" onClick={() => setMpSheetOpen(true)}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#009EE3]/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-[#009EE3]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Mercado Pago</h3>
                  <p className="text-xs text-muted-foreground">Pagamentos online e maquininha</p>
                </div>
              </div>
              {mpLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : isMpConnected ? (
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Conectado</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Desconectado</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* iFood Config Sheet */}
      <Sheet open={ifoodSheetOpen} onOpenChange={setIfoodSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#EA1D2C]" />
              Configuração iFood
            </SheetTitle>
            <SheetDescription>Conecte sua loja iFood para receber pedidos automaticamente</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {ifoodLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : isIfoodConnected ? (
              <div className="space-y-5">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Conectado ao iFood</span>
                </div>
                {ifoodConfig?.merchant_id && (
                  <div><Label className="text-xs text-muted-foreground">Merchant ID</Label><p className="text-sm font-mono">{maskId(ifoodConfig.merchant_id)}</p></div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Receber pedidos</Label><p className="text-xs text-muted-foreground">Ativar ou pausar o recebimento</p></div>
                  <Switch checked={ifoodConfig?.enabled ?? false} onCheckedChange={handleIfoodToggle} />
                </div>
                <Separator />
                <Button variant="destructive" className="w-full" onClick={handleIfoodDisconnect}>
                  <XCircle className="h-4 w-4 mr-2" />Desconectar iFood
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Como conectar:</h4>
                  <div className="space-y-2">
                    {["Clique em \"Gerar Código\" abaixo", "Acesse o Portal do Parceiro iFood e autorize", "Cole o código de autorização retornado"].map((text, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#EA1D2C] text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                        <p className="text-sm text-muted-foreground">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                {!userCode ? (
                  <Button className="w-full bg-[#EA1D2C] hover:bg-[#c4161f]" onClick={handleGenerateCode} disabled={generatingCode}>
                    {generatingCode ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}Gerar Código
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-muted border">
                      <Label className="text-xs text-muted-foreground">Seu código de verificação:</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-lg font-bold tracking-widest">{userCode}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(userCode); toast.success("Código copiado!"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {verificationUrl && (
                      <Button variant="outline" className="w-full" onClick={() => window.open(verificationUrl, "_blank")}>
                        <ExternalLink className="h-4 w-4 mr-2" />Abrir Portal iFood para autorizar
                      </Button>
                    )}
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm">Código de autorização do iFood:</Label>
                      <Input placeholder="Cole aqui o código retornado pelo iFood" value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
                      <Button className="w-full bg-[#EA1D2C] hover:bg-[#c4161f]" onClick={handleExchangeToken} disabled={connecting || !authCode.trim()}>
                        {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Conectar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delivery Direto Config Sheet */}
      <Sheet open={ddSheetOpen} onOpenChange={setDdSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-[#0066CC]" />
              Configuração Delivery Direto
            </SheetTitle>
            <SheetDescription>Conecte sua loja do Delivery Direto para receber pedidos automaticamente</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {ddLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : isDdConnected ? (
              <div className="space-y-5">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Conectado ao Delivery Direto</span>
                </div>
                {ddConfig?.store_id && (
                  <div><Label className="text-xs text-muted-foreground">Store ID</Label><p className="text-sm font-mono">{maskId(ddConfig.store_id)}</p></div>
                )}
                {ddConfig?.username && (
                  <div><Label className="text-xs text-muted-foreground">Usuário</Label><p className="text-sm font-mono">{ddConfig.username}</p></div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Receber pedidos</Label><p className="text-xs text-muted-foreground">Ativar ou pausar o recebimento</p></div>
                  <Switch checked={ddConfig?.enabled ?? false} onCheckedChange={handleDdToggle} />
                </div>
                <Separator />
                <Button variant="destructive" className="w-full" onClick={handleDdDisconnect}>
                  <XCircle className="h-4 w-4 mr-2" />Desconectar Delivery Direto
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Como conectar:</h4>
                  <div className="space-y-2">
                    {[
                      "Acesse o painel do Delivery Direto e copie o Store ID da sua loja",
                      "Insira o username e password gerados no painel",
                      "Clique em Conectar"
                    ].map((text, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#0066CC] text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                        <p className="text-sm text-muted-foreground">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Store ID</Label>
                    <Input placeholder="Ex: abc123-store-id" value={ddStoreId} onChange={(e) => setDdStoreId(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Username</Label>
                    <Input placeholder="Usuário gerado no painel DD" value={ddUsername} onChange={(e) => setDdUsername(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Password</Label>
                    <Input type="password" placeholder="Senha gerada no painel DD" value={ddPassword} onChange={(e) => setDdPassword(e.target.value)} />
                  </div>
                  <Button className="w-full bg-[#0066CC] hover:bg-[#0055AA]" onClick={handleDdConnect} disabled={ddConnecting || !ddStoreId.trim() || !ddUsername.trim() || !ddPassword.trim()}>
                    {ddConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Conectar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mercado Pago Config Sheet */}
      <Sheet open={mpSheetOpen} onOpenChange={setMpSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#009EE3]" />
              Mercado Pago
            </SheetTitle>
            <SheetDescription>Conecte sua conta do Mercado Pago para pagamentos online e maquininha</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {mpLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : isMpConnected ? (
              <div className="space-y-5">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Conectado ao Mercado Pago</span>
                </div>
                {mpConfig?.connected_at && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Conectado em</Label>
                    <p className="text-sm">{new Date(mpConfig.connected_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
                <Separator />
                <Button variant="destructive" className="w-full" onClick={handleMpDisconnect} disabled={disconnectingMp}>
                  {disconnectingMp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Desconectar Mercado Pago
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Ao clicar no botão abaixo, você será redirecionado para o Mercado Pago para autorizar a conexão. Nenhuma credencial manual é necessária.
                </p>
                <Button
                  onClick={handleStartMpOAuth}
                  disabled={startingOAuth}
                  className="w-full bg-[#009EE3] hover:bg-[#007BB8]"
                  size="lg"
                >
                  {startingOAuth ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Redirecionando...</>
                  ) : (
                    <><ExternalLink className="mr-2 h-4 w-4" />Conectar com Mercado Pago</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default IntegrationsTab;
