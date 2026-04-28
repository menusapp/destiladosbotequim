/**
 * Gatekeeper do onboarding QZ Tray.
 *
 * Renderiza o `<QzOnboardingDialog />` automaticamente quando:
 *  1. O usuário está em desktop (NUNCA aparece em mobile/tablet)
 *  2. O método de impressão configurado para o restaurante é "qz_tray"
 *  3. O usuário ainda NÃO completou o onboarding (qz:configured !== "true")
 *     E não há impressora salva (defesa extra: se já tem impressora salva,
 *     consideramos configurado e nunca mais mostramos o popup)
 *  4. O usuário não dispensou o aviso na sessão atual
 *
 * Isso evita que o popup do QZ Tray apareça do nada — em vez disso, o
 * usuário vê primeiro um modal explicativo nosso, e só dispara a conexão
 * ao clicar em "Conectar impressora".
 *
 * NÃO conecta ao QZ ao montar — apenas mostra o convite.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isQzConfigured,
  isQzOnboardingDismissed,
  getSavedQzPrinter,
  markQzConfigured,
} from "@/lib/qzPrinterConfig";
import { QzOnboardingDialog } from "./QzOnboardingDialog";

interface Props {
  restaurantId: string;
}

// Detecta mobile/tablet — popup só deve aparecer em desktop, pois QZ Tray
// é um app de desktop (Windows/Mac/Linux) e não roda em celulares.
const isDesktopDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isSmallScreen = window.innerWidth < 1024;
  return !isMobileUA && !isSmallScreen;
};

export const QzOnboardingGate = ({ restaurantId }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      // 1) Nunca em mobile/tablet
      if (!isDesktopDevice()) return;

      // 2) Já dispensou nesta sessão? Não mostra.
      if (isQzOnboardingDismissed()) return;

      // 3) Defesa extra: se já tem impressora salva, marca como configurado
      // e nunca mais mostra (cobre casos de localStorage parcial).
      if (getSavedQzPrinter()) {
        if (!isQzConfigured()) markQzConfigured();
        return;
      }

      // 4) Já configurou? Não mostra.
      if (isQzConfigured()) return;

      try {
        const { data } = await supabase
          .from("printer_settings")
          .select("print_method")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();
        const method = (data as any)?.print_method;
        if (cancelled) return;
        if (method === "qz_tray") {
          // Pequeno delay pra não atropelar a UI inicial
          setTimeout(() => !cancelled && setOpen(true), 1200);
        }
      } catch (e) {
        console.warn("[QzOnboardingGate] erro ao checar print_method:", e);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (!open) return null;
  return <QzOnboardingDialog open={open} onClose={() => setOpen(false)} />;
};

export default QzOnboardingGate;
