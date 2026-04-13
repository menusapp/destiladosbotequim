import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Palette, User, Phone, CreditCard, Image, Clock, Percent, Save, FileText, Timer, RotateCcw, MapPin, Printer, HardDrive, Truck } from "lucide-react";
import { lazy, Suspense } from "react";

const BusinessHoursSettings = lazy(() => import("./BusinessHoursSettings"));
const DeliveryZonesSettings = lazy(() => import("./DeliveryZonesSettings"));
const PaymentMethodsSettings = lazy(() => import("./PaymentMethodsSettings"));
const OnlinePaymentsSettings = lazy(() => import("./OnlinePaymentsSettings"));
const PrintersSettings = lazy(() => import("./PrintersSettings"));
const BackupSettings = lazy(() => import("./BackupSettings"));

interface Settings {
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  service_fee_enabled: boolean;
  service_fee_percentage: number;
  prep_time_minutes: number;
  login_require_name: boolean;
  login_require_phone: boolean;
  bill_request_enabled: boolean;
  show_prep_timer: boolean;
}

const SubTabLoading = () => (
  <div className="text-center py-12">
    <p className="text-muted-foreground">Carregando...</p>
  </div>
);

const CompanyDataSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [settings, setSettings] = useState<Settings>({
    logo_url: null,
    banner_url: null,
    primary_color: "#FF6B35",
    service_fee_enabled: false,
    service_fee_percentage: 10,
    prep_time_minutes: 30,
    login_require_name: true,
    login_require_phone: false,
    bill_request_enabled: true,
    show_prep_timer: true,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [restaurantId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("logo_url, banner_url, primary_color, service_fee_enabled, service_fee_percentage, prep_time_minutes, login_require_name, login_require_phone, bill_request_enabled, show_prep_timer")
        .eq("id", restaurantId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings({
          logo_url: data.logo_url,
          banner_url: data.banner_url,
          primary_color: data.primary_color || "#FF6B35",
          service_fee_enabled: data.service_fee_enabled || false,
          service_fee_percentage: data.service_fee_percentage || 10,
          prep_time_minutes: data.prep_time_minutes || 30,
          login_require_name: data.login_require_name ?? true,
          login_require_phone: data.login_require_phone ?? false,
          bill_request_enabled: data.bill_request_enabled ?? true,
          show_prep_timer: data.show_prep_timer ?? true,
        });
      }
    } catch (error) {
      toast.error("Erro ao carregar configurações");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Por favor, selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 2MB"); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${restaurantId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
      const logoUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.from("restaurants").update({ logo_url: logoUrl }).eq("id", restaurantId);
      if (updateError) throw updateError;
      setSettings({ ...settings, logo_url: logoUrl });
      toast.success("Logo atualizada!");
    } catch (error) { toast.error("Erro ao fazer upload da logo"); console.error(error); } finally { setUploading(false); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Por favor, selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5MB"); return; }
    setUploadingBanner(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${restaurantId}-banner-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
      const bannerUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.from("restaurants").update({ banner_url: bannerUrl }).eq("id", restaurantId);
      if (updateError) throw updateError;
      setSettings({ ...settings, banner_url: bannerUrl });
      toast.success("Banner atualizado!");
    } catch (error) { toast.error("Erro ao fazer upload do banner"); console.error(error); } finally { setUploadingBanner(false); }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          primary_color: settings.primary_color,
          service_fee_enabled: settings.service_fee_enabled,
          service_fee_percentage: settings.service_fee_percentage,
          prep_time_minutes: settings.prep_time_minutes,
          login_require_name: settings.login_require_name,
          login_require_phone: settings.login_require_phone,
          bill_request_enabled: settings.bill_request_enabled,
          show_prep_timer: settings.show_prep_timer,
        })
        .eq('id', restaurantId);
      if (error) throw error;
      toast.success("Configurações salvas!");
      await fetchSettings();
    } catch (error) { toast.error("Erro ao salvar configurações"); console.error(error); }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">Configurações Gerais</h2>
        <p className="text-muted-foreground font-light">Personalize a aparência e comportamento do seu cardápio digital</p>
      </div>

      <Tabs defaultValue="visual" className="space-y-6">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="visual" className="gap-2">
            <Image className="h-4 w-4" />
            Identidade Visual
          </TabsTrigger>
          <TabsTrigger value="operational" className="gap-2">
            <Clock className="h-4 w-4" />
            Operacional
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="h-4 w-4" />
            Horário
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-2">
            <MapPin className="h-4 w-4" />
            Regiões de Entrega
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-2">
            <Printer className="h-4 w-4" />
            Impressoras
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <HardDrive className="h-4 w-4" />
            Backup
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Identidade Visual */}
        <TabsContent value="visual" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Banner Card */}
            <Card>
              <CardHeader>
                <CardTitle>Banner do Cardápio</CardTitle>
                <CardDescription>Imagem de fundo exibida no topo do cardápio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full h-36 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                  {settings.banner_url ? (
                    <img src={settings.banner_url} alt="Banner atual" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground text-sm flex flex-col items-center gap-1">
                      <Image className="h-8 w-8 opacity-40" />
                      <span>Nenhum banner</span>
                    </div>
                  )}
                </div>
                <div>
                  <Input
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    disabled={uploadingBanner}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">16:9, mínimo 1600×900px, máx 5MB</p>
                </div>
              </CardContent>
            </Card>

            {/* Logo + Cor Card */}
            <Card>
              <CardHeader>
                <CardTitle>Logo & Cor Principal</CardTitle>
                <CardDescription>Identidade visual exibida no cardápio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start gap-5">
                  <div className="shrink-0">
                    <div className="w-24 h-24 rounded-full border-4 border-border bg-muted flex items-center justify-center overflow-hidden">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground opacity-40" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="logo-upload" className="text-xs text-muted-foreground">Quadrada, mín 512×512px, máx 2MB</Label>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="flex items-center gap-2 mb-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Cor Principal
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settings.primary_color}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      className="w-28 font-mono text-sm"
                    />
                    <div className="h-9 flex-1 rounded-md" style={{ backgroundColor: settings.primary_color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={handleSaveSettings} className="w-full sm:w-auto gap-2">
            <Save className="h-4 w-4" />
            Salvar Identidade Visual
          </Button>
        </TabsContent>

        {/* Tab 2: Operacional (merged: Operacional + Cadastro de Clientes + Cardápio) */}
        <TabsContent value="operational" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Taxa de Serviço */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Taxa de Serviço
                </CardTitle>
                <CardDescription>Configure a cobrança de taxa de serviço nos pedidos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label htmlFor="service-fee-enabled" className="font-medium cursor-pointer">Cobrar Taxa de Serviço</Label>
                  <Switch
                    id="service-fee-enabled"
                    checked={settings.service_fee_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, service_fee_enabled: checked })}
                  />
                </div>
                {settings.service_fee_enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="service-fee-percentage">Porcentagem (%)</Label>
                    <Input
                      id="service-fee-percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.service_fee_percentage}
                      onChange={(e) => setSettings({ ...settings, service_fee_percentage: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tempo de Preparo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Tempo de Preparo nos Pedidos
                </CardTitle>
                <CardDescription>Exibe o tempo de preparo individual de cada produto nos pedidos de mesa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <Label htmlFor="show-prep-timer" className="font-medium cursor-pointer">Ativar tempo de preparo</Label>
                  <Switch
                    id="show-prep-timer"
                    checked={settings.show_prep_timer}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_prep_timer: checked })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, exibe uma contagem regressiva ao lado de cada item pedido na comanda, baseada no tempo de preparo cadastrado em cada produto.
                </p>
                <Button
                  variant="outline"
                  className="gap-2 w-full"
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('tables')
                        .update({ occupied_at: new Date().toISOString() })
                        .eq('restaurant_id', restaurantId)
                        .eq('is_occupied', true);
                      if (error) throw error;
                      toast.success("Tempo de todas as mesas zerado!");
                    } catch {
                      toast.error("Erro ao zerar tempo");
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Zerar tempo de todas as mesas
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tempo Estimado Delivery/Retirada */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Tempo Estimado para Delivery / Retirada
              </CardTitle>
              <CardDescription>Tempo informado ao cliente nas notificações e no checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prep-time-delivery">Preparo + Entrega (minutos)</Label>
                  <Input
                    id="prep-time-delivery"
                    type="number"
                    min="1"
                    max="180"
                    value={settings.prep_time_minutes}
                    onChange={(e) => setSettings({ ...settings, prep_time_minutes: parseInt(e.target.value) || 30 })}
                  />
                  <p className="text-xs text-muted-foreground">Usado como tempo estimado nos pedidos delivery</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cadastro de Clientes (merged) */}
          <Card>
            <CardHeader>
              <CardTitle>Campos de Cadastro de Clientes</CardTitle>
              <CardDescription>Defina quais informações são solicitadas ao cliente no login do cardápio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {/* CPF - Always required */}
                <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">CPF</p>
                      <p className="text-xs text-muted-foreground">Identificação única do cliente</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Obrigatório</span>
                    <Switch checked disabled />
                  </div>
                </div>

                {/* Nome */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Nome do Cliente</p>
                      <p className="text-xs text-muted-foreground">Solicitar nome no cadastro</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.login_require_name}
                    onCheckedChange={(checked) => setSettings({ ...settings, login_require_name: checked })}
                  />
                </div>

                {/* Telefone */}
                <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Telefone</p>
                      <p className="text-xs text-muted-foreground">Solicitar número de telefone</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.login_require_phone}
                    onCheckedChange={(checked) => setSettings({ ...settings, login_require_phone: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cardápio config (merged) */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Cardápio</CardTitle>
              <CardDescription>Controle funcionalidades disponíveis no cardápio digital</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Permitir clientes pedirem conta</p>
                      <p className="text-xs text-muted-foreground">Exibe o botão "Pedir Conta" no cardápio digital dos clientes nas mesas</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.bill_request_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, bill_request_enabled: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveSettings} className="w-full sm:w-auto gap-2">
            <Save className="h-4 w-4" />
            Salvar Configurações Operacionais
          </Button>
        </TabsContent>

        {/* Tab 3: Horário de Funcionamento */}
        <TabsContent value="hours">
          <Suspense fallback={<SubTabLoading />}>
            <BusinessHoursSettings restaurantId={restaurantId} />
          </Suspense>
        </TabsContent>

        {/* Tab 4: Regiões de Entrega */}
        <TabsContent value="delivery">
          <Suspense fallback={<SubTabLoading />}>
            <DeliveryZonesSettings restaurantId={restaurantId} />
          </Suspense>
        </TabsContent>

        {/* Tab 5: Formas de Pagamento */}
        <TabsContent value="payments" className="space-y-8">
          <Suspense fallback={<SubTabLoading />}>
            <PaymentMethodsSettings restaurantId={restaurantId} />
            <OnlinePaymentsSettings restaurantId={restaurantId} />
          </Suspense>
        </TabsContent>

        {/* Tab 6: Impressoras */}
        <TabsContent value="printers">
          <Suspense fallback={<SubTabLoading />}>
            <PrintersSettings restaurantId={restaurantId} />
          </Suspense>
        </TabsContent>

        {/* Tab 7: Backup e Restauração */}
        <TabsContent value="backup">
          <Suspense fallback={<SubTabLoading />}>
            <BackupSettings restaurantId={restaurantId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyDataSettings;
