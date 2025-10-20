import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Palette } from "lucide-react";

interface Settings {
  logo_url: string | null;
  primary_color: string;
  service_fee_enabled: boolean;
  service_fee_percentage: number;
  prep_time_minutes: number;
  target_cmv_percentage: number;
}

const SettingsTab = ({ restaurantId }: { restaurantId: string }) => {
  const [settings, setSettings] = useState<Settings>({
    logo_url: null,
    primary_color: "#FF6B35",
    service_fee_enabled: false,
    service_fee_percentage: 10,
    prep_time_minutes: 30,
    target_cmv_percentage: 30,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [restaurantId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("logo_url, primary_color, service_fee_enabled, service_fee_percentage, prep_time_minutes, target_cmv_percentage")
        .eq("id", restaurantId)
        .single();

      if (error) throw error;
      
      if (data) {
        setSettings({
          logo_url: data.logo_url,
          primary_color: data.primary_color || "#FF6B35",
          service_fee_enabled: data.service_fee_enabled || false,
          service_fee_percentage: data.service_fee_percentage || 10,
          prep_time_minutes: data.prep_time_minutes || 30,
          target_cmv_percentage: data.target_cmv_percentage || 30,
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

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);

    try {
      // Upload para o bucket
      const fileExt = file.name.split(".").pop();
      const fileName = `${restaurantId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      // Atualizar no banco
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

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          primary_color: settings.primary_color,
          service_fee_enabled: settings.service_fee_enabled,
          service_fee_percentage: settings.service_fee_percentage,
          prep_time_minutes: settings.prep_time_minutes,
          target_cmv_percentage: settings.target_cmv_percentage,
        })
        .eq("id", restaurantId);

      if (error) throw error;

      toast.success("Configurações salvas!");
      await fetchSettings(); // Recarrega os dados do banco para confirmar
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
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Logo do Restaurante
          </CardTitle>
          <CardDescription>
            Faça upload da logo do seu restaurante (máx. 2MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.logo_url && (
            <div className="flex justify-center">
              <img
                src={settings.logo_url}
                alt="Logo"
                className="h-32 w-32 object-contain rounded-lg border"
              />
            </div>
          )}
          <div>
            <Input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={uploading}
            />
            {uploading && (
              <p className="text-sm text-muted-foreground mt-2">Fazendo upload...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cor Principal
          </CardTitle>
          <CardDescription>
            Personalize a cor principal do seu cardápio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Cor Principal</Label>
            <div className="flex gap-2">
              <Input
                id="primary-color"
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Esta cor será aplicada em todo o cardápio digital
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Serviço */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Serviço</CardTitle>
          <CardDescription>
            Configure se deseja cobrar taxa de serviço e qual a porcentagem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="service-fee-enabled">Cobrar Taxa de Serviço</Label>
            <Switch
              id="service-fee-enabled"
              checked={settings.service_fee_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, service_fee_enabled: checked })
              }
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
                onChange={(e) =>
                  setSettings({ ...settings, service_fee_percentage: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tempo de Preparo */}
      <Card>
        <CardHeader>
          <CardTitle>Tempo Médio de Preparo</CardTitle>
          <CardDescription>
            Tempo estimado para preparar os pedidos (será mostrado aos clientes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="prep-time">Tempo em minutos</Label>
          <Input
            id="prep-time"
            type="number"
            min="1"
            max="120"
            value={settings.prep_time_minutes}
            onChange={(e) =>
              setSettings({ ...settings, prep_time_minutes: parseInt(e.target.value) || 30 })
            }
          />
          <p className="text-sm text-muted-foreground">
            Os clientes verão um cronômetro de {settings.prep_time_minutes} minutos após enviar o pedido
          </p>
        </CardContent>
      </Card>

      {/* CMV Desejado */}
      <Card>
        <CardHeader>
          <CardTitle>CMV Desejado</CardTitle>
          <CardDescription>
            Defina a porcentagem ideal de Custo de Mercadorias Vendidas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="target-cmv">Porcentagem (%)</Label>
          <Input
            id="target-cmv"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={settings.target_cmv_percentage}
            onChange={(e) =>
              setSettings({ ...settings, target_cmv_percentage: parseFloat(e.target.value) || 30 })
            }
          />
          <p className="text-sm text-muted-foreground">
            Produtos com CMV acima deste valor serão destacados como alerta na aba CMV
          </p>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <Button onClick={handleSaveSettings} className="w-full">
        Salvar Configurações
      </Button>
    </div>
  );
};

export default SettingsTab;
