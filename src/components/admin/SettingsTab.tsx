import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Palette, Star, Clock } from "lucide-react";

interface Settings {
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  service_fee_enabled: boolean;
  service_fee_percentage: number;
  rating: number;
  review_count: number;
  prep_time_minutes: number;
}

const SettingsTab = ({ restaurantId }: { restaurantId: string }) => {
  const [settings, setSettings] = useState<Settings>({
    logo_url: null,
    banner_url: null,
    primary_color: "#FF6B35",
    service_fee_enabled: false,
    service_fee_percentage: 10,
    rating: 4.8,
    review_count: 12,
    prep_time_minutes: 30,
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
        .select("logo_url, banner_url, primary_color, service_fee_enabled, service_fee_percentage, rating, review_count, prep_time_minutes")
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
          rating: data.rating || 4.8,
          review_count: data.review_count || 12,
          prep_time_minutes: data.prep_time_minutes || 30,
        });
      } else {
        setSettings((prev) => ({ ...prev }));
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

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${restaurantId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ logo_url: logoUrl })
        .eq("id", restaurantId);

      if (updateError) throw updateError;

      setSettings({ ...settings, logo_url: logoUrl });
      toast.success("Logo atualizada!");
    } catch (error) {
      toast.error("Erro ao fazer upload da logo");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploadingBanner(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${restaurantId}-banner-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const bannerUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ banner_url: bannerUrl })
        .eq("id", restaurantId);

      if (updateError) throw updateError;

      setSettings({ ...settings, banner_url: bannerUrl });
      toast.success("Banner atualizado!");
    } catch (error) {
      toast.error("Erro ao fazer upload do banner");
      console.error(error);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          primary_color: settings.primary_color,
          service_fee_enabled: settings.service_fee_enabled,
          service_fee_percentage: settings.service_fee_percentage,
          rating: settings.rating,
          review_count: settings.review_count,
          prep_time_minutes: settings.prep_time_minutes,
        })
        .eq('id', restaurantId);

      if (error) throw error;

      toast.success("Configurações salvas!");
      await fetchSettings();
    } catch (error) {
      toast.error("Erro ao salvar configurações");
      console.error(error);
    }
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
      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="menu">Cardápio Digital</TabsTrigger>
          <TabsTrigger value="fees">Taxa de Serviço</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Personalização do Cardápio Digital
              </CardTitle>
              <CardDescription>
                Configure as imagens e informações que aparecerão no seu cardápio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Banner */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Banner do Cardápio</Label>
                  <p className="text-sm text-muted-foreground">
                    Imagem de fundo que aparece no topo do cardápio
                  </p>
                </div>
                {settings.banner_url && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
                    <img 
                      src={settings.banner_url} 
                      alt="Banner atual" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="banner-upload">Selecionar Banner</Label>
                  <Input
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    disabled={uploadingBanner}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recomendado: imagem horizontal 16:9, mínimo 1600x900px, máximo 5MB
                  </p>
                </div>
              </div>

              <div className="border-t" />

              {/* Logo */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Logo Principal</Label>
                  <p className="text-sm text-muted-foreground">
                    Logo que aparece no centro do cardápio (formato circular)
                  </p>
                </div>
                {settings.logo_url && (
                  <div className="flex justify-center">
                    <img 
                      src={settings.logo_url} 
                      alt="Logo atual" 
                      className="w-32 h-32 object-cover rounded-full border-4 border-border"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="logo-upload">Selecionar Logo</Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recomendado: imagem quadrada, mínimo 512x512px, máximo 2MB
                  </p>
                </div>
              </div>

              <div className="border-t" />

              {/* Cor Principal */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Palette className="h-5 w-5" />
                  Cor Principal
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Cor Principal do Cardápio</Label>
                  <div className="flex gap-4 items-center">
                    <Input
                      id="primary-color"
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) =>
                        setSettings({ ...settings, primary_color: e.target.value })
                      }
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settings.primary_color}
                      onChange={(e) =>
                        setSettings({ ...settings, primary_color: e.target.value })
                      }
                      placeholder="#FF6B35"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Esta cor será usada em botões, destaques e elementos principais do cardápio
                  </p>
                </div>
              </div>

              <div className="border-t" />

              {/* Avaliações */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Star className="h-5 w-5" />
                  Avaliações
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rating">Nota (estrelas)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={settings.rating}
                      onChange={(e) =>
                        setSettings({ ...settings, rating: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="4.8"
                    />
                    <p className="text-xs text-muted-foreground">
                      Avaliação média (0 a 5 estrelas)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-count">Número de Avaliações</Label>
                    <Input
                      id="review-count"
                      type="number"
                      min="0"
                      value={settings.review_count}
                      onChange={(e) =>
                        setSettings({ ...settings, review_count: parseInt(e.target.value) || 0 })
                      }
                      placeholder="12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total de avaliações recebidas
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Tempo Estimado */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Clock className="h-5 w-5" />
                  Tempo Estimado
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prep-time">Tempo de Preparo (minutos)</Label>
                  <Input
                    id="prep-time"
                    type="number"
                    min="0"
                    value={settings.prep_time_minutes}
                    onChange={(e) =>
                      setSettings({ ...settings, prep_time_minutes: parseInt(e.target.value) || 0 })
                    }
                    placeholder="30"
                  />
                  <p className="text-sm text-muted-foreground">
                    Tempo médio de preparo geral do restaurante
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                Salvar Configurações do Cardápio
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Taxa de Serviço</CardTitle>
              <CardDescription>
                Configure se deseja cobrar taxa de serviço e qual a porcentagem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Habilitar Taxa de Serviço</Label>
                  <p className="text-sm text-muted-foreground">
                    Adicionar taxa opcional nos pedidos
                  </p>
                </div>
                <Switch
                  checked={settings.service_fee_enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, service_fee_enabled: checked })
                  }
                />
              </div>

              {settings.service_fee_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="service-fee">Percentual da Taxa (%)</Label>
                  <Input
                    id="service-fee"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.service_fee_percentage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        service_fee_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Percentual aplicado sobre o total do pedido
                  </p>
                </div>
              )}

              <Button onClick={handleSaveSettings} className="w-full">
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsTab;
