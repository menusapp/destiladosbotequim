import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, ShieldCheck, ExternalLink } from "lucide-react";

const QZ_DOWNLOAD_URL = "https://qz.io/download/";

interface QzTrayDownloadCardProps {
  /** "full" para a aba Impressoras (com aviso de segurança), "compact" para Geral */
  variant?: "full" | "compact";
}

export const QzTrayDownloadCard = ({ variant = "full" }: QzTrayDownloadCardProps) => {
  if (variant === "compact") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-5 w-5 text-primary" />
            Vai usar impressão automática?
          </CardTitle>
          <CardDescription>
            Baixe o QZ Tray e depois siga o passo a passo em <strong>Configurações &gt; Impressoras</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto gap-2">
            <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Baixar QZ Tray
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Baixar QZ Tray
        </CardTitle>
        <CardDescription>
          Para usar impressão automática, instale o QZ Tray no computador onde a impressora está conectada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild size="lg" className="w-full sm:w-auto gap-2">
          <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            Baixar QZ Tray
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Use sempre o link oficial da QZ para baixar a versão mais recente com segurança.
        </p>
      </CardContent>
    </Card>
  );
};

export default QzTrayDownloadCard;
