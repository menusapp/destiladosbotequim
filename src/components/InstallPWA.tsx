import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "menus-pwa-dismiss";

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    if (dismissed) return;

    // Detect if already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone) return;

    // iOS Safari detection
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSHint(false);
  };

  if (dismissed || (!deferredPrompt && !showIOSHint)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md rounded-xl border bg-background p-4 shadow-lg animate-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      {deferredPrompt ? (
        <div className="flex items-center gap-3">
          <Download className="h-8 w-8 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Instalar Menu's</p>
            <p className="text-xs text-muted-foreground">Acesse direto da tela inicial</p>
          </div>
          <Button size="sm" onClick={handleInstall}>Instalar</Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Share className="h-8 w-8 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Instalar Menu's</p>
            <p className="text-xs text-muted-foreground">
              Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
