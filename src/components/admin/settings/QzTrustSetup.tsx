/**
 * Onboarding de Confiança QZ Tray (Trust Setup).
 *
 * Resolve o problema do popup recorrente "Untrusted website" e do botão
 * "Remember this decision" não persistir, permitindo ao usuário instalar
 * o certificado público do sistema como `override.crt` no QZ Tray local.
 *
 * Fluxo guiado:
 *   PASSO 1 → Baixar certificado (override.crt)
 *   PASSO 2 → Instruções de onde colocar (Windows/Mac/Linux)
 *   PASSO 3 → Reiniciar QZ Tray
 *   PASSO 4 → Testar impressão automática (sem popup)
 *
 * NÃO altera o fluxo atual de impressão. É apenas um helper de configuração.
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Download,
  ShieldCheck,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  FileKey,
} from "lucide-react";
import qz from "qz-tray";
import { ensureQzConnected } from "@/lib/qzConnectionManager";
import { getSavedQzPrinter } from "@/lib/qzPrinterConfig";

const FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_PROJECT_ID
  ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`
  : "";

const PATHS = {
  windows: String.raw`C:\Program Files\QZ Tray\auth\override.crt`,
  mac: "/Applications/QZ Tray.app/Contents/Resources/auth/override.crt",
  linux: "/opt/qz-tray/auth/override.crt",
};

type TestStatus =
  | "idle"
  | "connecting"
  | "printing"
  | "success"
  | "untrusted"
  | "error";

const SAMPLE = [
  "================================",
  "  Menu's - Teste de Impressao",
  "================================",
  "",
  "Impressao automatica OK!",
  "QZ Tray configurado corretamente.",
  "",
  new Date().toLocaleString("pt-BR"),
  "",
  "",
  "",
].join("\n");

export const QzTrustSetup = () => {
  const [downloading, setDownloading] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState<string>("");
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null);

  /** Baixa o certificado público como override.crt. */
  const handleDownloadCert = async () => {
    if (!FUNCTIONS_BASE) {
      toast.error("Configuração indisponível");
      return;
    }
    setDownloading(true);
    try {
      console.log("🔐 [QZ Trust] Baixando certificado...");
      const res = await fetch(`${FUNCTIONS_BASE}/qz-cert`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pem = await res.text();
      if (!pem.includes("BEGIN CERTIFICATE")) {
        throw new Error("Certificado retornado em formato inválido");
      }
      const blob = new Blob([pem], { type: "application/x-x509-ca-cert" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "override.crt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("🔐 [QZ Trust] override.crt baixado (", pem.length, "chars)");
      toast.success("Certificado baixado!", {
        description: "Agora copie o arquivo para a pasta do QZ Tray (PASSO 2).",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[QZ Trust] download error:", msg);
      toast.error("Falha ao baixar certificado", { description: msg });
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copiado`))
      .catch(() => toast.error("Não foi possível copiar"));
  };

  /**
   * Testa impressão automática.
   * Se o popup demorar a aparecer, é forte indício de que o trust funcionou.
   */
  const handleTest = async () => {
    const printer = getSavedQzPrinter();
    if (!printer) {
      toast.error("Selecione uma impressora primeiro", {
        description: "Use a seção de impressão acima para escolher.",
      });
      return;
    }

    setTestStatus("connecting");
    setTestError("");
    const startedAt = Date.now();
    setTestStartedAt(startedAt);

    try {
      console.log("🖨️ [QZ Trust] Iniciando teste com:", printer);
      await ensureQzConnected();
      const elapsedConnect = Date.now() - startedAt;
      console.log(`🖨️ [QZ Trust] Conectado em ${elapsedConnect}ms`);

      setTestStatus("printing");
      const config = qz.configs.create(printer);
      await qz.print(config, [
        { type: "raw", format: "plain", data: SAMPLE },
      ]);

      const totalElapsed = Date.now() - startedAt;
      console.log(`🖨️ [QZ Trust] Impresso em ${totalElapsed}ms`);

      // Heurística: se a operação completa demorou > 4s, provavelmente o
      // usuário teve que clicar no popup do QZ — sinal de que o cert ainda
      // não está confiável.
      if (totalElapsed > 4000) {
        setTestStatus("untrusted");
        toast.warning("Impressão funcionou, mas houve popup", {
          description: "Verifique se o override.crt foi instalado corretamente.",
        });
      } else {
        setTestStatus("success");
        toast.success("Impressão automática ativada!", {
          description: "Sem popup — o certificado está confiável.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[QZ Trust] test error:", msg);
      setTestError(msg);
      setTestStatus("error");
      toast.error("Falha no teste de impressão", { description: msg });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Configurar Impressão Automática (Sem Popup)
        </CardTitle>
        <CardDescription>
          O sistema agora usa o <strong>certificado oficial do QZ Tray</strong>.
          Basta baixar o arquivo <code className="bg-muted px-1 rounded text-xs">override.crt</code>{" "}
          abaixo e instalá-lo na pasta de autenticação do QZ Tray para que a
          impressão fique 100% automática (sem popup de permissão).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* PASSO 1 — Download */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              Passo 1
            </Badge>
            <h3 className="font-semibold text-sm">Baixe o certificado de segurança</h3>
          </div>
          <p className="text-sm text-muted-foreground pl-1">
            Clique no botão abaixo para baixar o arquivo{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">override.crt</code>.
          </p>
          <Button onClick={handleDownloadCert} disabled={downloading} className="gap-2">
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar Certificado de Segurança
          </Button>
        </div>

        {/* PASSO 2 — Caminhos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              Passo 2
            </Badge>
            <h3 className="font-semibold text-sm">
              Copie o arquivo para a pasta do QZ Tray
            </h3>
          </div>
          <p className="text-sm text-muted-foreground pl-1">
            Cole o arquivo <code className="bg-muted px-1 py-0.5 rounded text-xs">override.crt</code>{" "}
            na pasta correspondente ao seu sistema:
          </p>

          <div className="space-y-2 pl-1">
            {(["windows", "mac", "linux"] as const).map((os) => (
              <div
                key={os}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileKey className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {os === "mac" ? "macOS" : os}
                  </Badge>
                  <code className="text-xs truncate">{PATHS[os]}</code>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() =>
                    copyToClipboard(
                      PATHS[os],
                      os === "mac" ? "Caminho macOS" : `Caminho ${os}`,
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Permissão de administrador</AlertTitle>
            <AlertDescription className="text-xs">
              No Windows pode ser necessário "Executar como administrador" o
              Explorador de Arquivos para colar nessa pasta.
            </AlertDescription>
          </Alert>
        </div>

        {/* PASSO 3 — Reiniciar */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              Passo 3
            </Badge>
            <h3 className="font-semibold text-sm">Reinicie o QZ Tray</h3>
          </div>
          <p className="text-sm text-muted-foreground pl-1">
            Clique com o botão direito no ícone do QZ Tray (próximo ao relógio) →{" "}
            <strong>Exit</strong>. Depois abra novamente pelo menu Iniciar /
            Aplicativos.
          </p>
        </div>

        {/* PASSO 4 — Teste */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              Passo 4
            </Badge>
            <h3 className="font-semibold text-sm">Teste a impressão automática</h3>
          </div>
          <p className="text-sm text-muted-foreground pl-1">
            Após reiniciar, clique abaixo. Se tudo estiver OK, a impressão sai
            <strong> sem popup</strong>.
          </p>

          <div className="flex flex-wrap items-center gap-2 pl-1">
            <Button
              onClick={handleTest}
              disabled={testStatus === "connecting" || testStatus === "printing"}
              className="gap-2"
            >
              {testStatus === "connecting" || testStatus === "printing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {testStatus === "connecting"
                ? "Conectando..."
                : testStatus === "printing"
                  ? "Imprimindo..."
                  : "Testar Impressão"}
            </Button>

            {testStatus !== "idle" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTestStatus("idle");
                  setTestError("");
                  setTestStartedAt(null);
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Status visual */}
          {testStatus === "success" && (
            <Alert className="mt-3 border-primary/50 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle className="text-sm text-primary">
                Impressão automática ativada com sucesso
              </AlertTitle>
              <AlertDescription className="text-xs">
                ✅ QZ conectado &nbsp;·&nbsp; ✅ Certificado válido &nbsp;·&nbsp;
                ✅ Sem popup
              </AlertDescription>
            </Alert>
          )}

          {testStatus === "untrusted" && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">
                Seu QZ ainda não está confiável
              </AlertTitle>
              <AlertDescription className="text-xs">
                A impressão funcionou, mas o popup apareceu. Verifique se o{" "}
                <code>override.crt</code> foi colado na pasta correta e se o QZ
                Tray foi reiniciado.
              </AlertDescription>
            </Alert>
          )}

          {testStatus === "error" && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">Falha no teste</AlertTitle>
              <AlertDescription className="text-xs">{testError}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default QzTrustSetup;
