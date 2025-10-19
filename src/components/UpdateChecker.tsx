import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AppVersion {
  version: string;
  release_notes: string | null;
  download_url_windows: string | null;
  download_url_mac: string | null;
  download_url_linux: string | null;
}

export const UpdateChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null);
  const [checking, setChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      // Obter versão atual do Electron
      let version = "1.0.0"; // fallback
      if (window.electronDB && window.electronDB.getVersion) {
        version = await window.electronDB.getVersion();
      }
      setCurrentVersion(version);

      const { data, error } = await supabase
        .from("app_versions")
        .select("*")
        .eq("is_current", true)
        .single();

      if (error) throw error;

      if (data && data.version !== version) {
        setLatestVersion(data);
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.error("Erro ao verificar atualizações:", error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Só verifica updates se estiver rodando no Electron
    if (window.electronDB) {
      checkForUpdates();
    }
  }, []);

  const handleUpdate = () => {
    if (!latestVersion) return;

    // Detectar sistema operacional
    const platform = navigator.platform.toLowerCase();
    let downloadUrl = "";

    if (platform.includes("win")) {
      downloadUrl = latestVersion.download_url_windows || "";
    } else if (platform.includes("mac")) {
      downloadUrl = latestVersion.download_url_mac || "";
    } else {
      downloadUrl = latestVersion.download_url_linux || "";
    }

    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    } else {
      alert("Download não disponível para seu sistema operacional");
    }
  };

  // Não mostra nada se não houver atualização ou não estiver no Electron
  if (!updateAvailable || !window.electronDB) return null;

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Download className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Nova versão disponível: v{latestVersion?.version}</p>
          {latestVersion?.release_notes && (
            <p className="text-sm text-muted-foreground mt-1">{latestVersion.release_notes}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleUpdate}
          disabled={checking}
          className="gap-2 flex-shrink-0"
        >
          {checking ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Atualizar
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
