import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Download, Monitor, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppVersion {
  version: string;
  release_notes: string | null;
  download_url_windows: string | null;
  download_url_mac: string | null;
  download_url_linux: string | null;
}

export const DesktopDownloadSection = () => {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentVersion();
  }, []);

  const fetchCurrentVersion = async () => {
    try {
      const { data, error } = await supabase
        .from("app_versions")
        .select("*")
        .eq("is_current", true)
        .single();

      if (error) throw error;
      setVersion(data);
    } catch (error) {
      console.error("Erro ao buscar versão:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (platform: 'windows' | 'mac' | 'linux') => {
    if (!version) {
      toast.error("Versão não disponível no momento");
      return;
    }

    let downloadUrl = "";
    let platformName = "";

    switch (platform) {
      case 'windows':
        downloadUrl = version.download_url_windows || "";
        platformName = "Windows";
        break;
      case 'mac':
        downloadUrl = version.download_url_mac || "";
        platformName = "macOS";
        break;
      case 'linux':
        downloadUrl = version.download_url_linux || "";
        platformName = "Linux";
        break;
    }

    if (downloadUrl) {
      toast.success(`Iniciando download para ${platformName}...`);
      window.open(downloadUrl, "_blank");
    } else {
      toast.info(`Download para ${platformName} em breve! Configure a URL no banco de dados.`);
    }
  };

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-20">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-20">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl">
            Versão Desktop 100% Offline
          </CardTitle>
          <CardDescription className="text-lg max-w-2xl mx-auto">
            Baixe o Menu's para seu computador e funcione completamente sem internet. 
            Perfeito para restaurantes que precisam de autonomia total.
          </CardDescription>
          {version && (
            <p className="text-sm text-muted-foreground">
              Versão atual: <span className="font-semibold text-primary">{version.version}</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 justify-center flex-wrap mb-6">
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2"
              onClick={() => handleDownload('windows')}
            >
              <Download className="h-5 w-5" />
              Windows
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2"
              onClick={() => handleDownload('mac')}
            >
              <Download className="h-5 w-5" />
              macOS
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2"
              onClick={() => handleDownload('linux')}
            >
              <Download className="h-5 w-5" />
              Linux
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span>100% Offline</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span>Banco de dados local</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span>Todas as funcionalidades</span>
            </div>
          </div>
          {version?.release_notes && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm font-semibold mb-2">Novidades nesta versão:</p>
              <p className="text-sm text-muted-foreground">{version.release_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
