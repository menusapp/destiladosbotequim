/**
 * Gatekeeper do onboarding QZ Tray.
 *
 * Renderiza o `<QzOnboardingDialog />` automaticamente quando:
 *  1. O método de impressão configurado para o restaurante é "qz_tray"
 *  2. O usuário ainda NÃO completou o onboarding (qz:configured !== "true")
 *  3. O usuário não dispensou o aviso na sessão atual
 *
 * Isso evita que o popup do QZ Tray apareça do nada — em vez disso, o
 * usuário vê primeiro um modal explicativo nosso, e só dispara a conexão
 * ao clicar em "Conectar impressora".
 *
 * NÃO conecta ao QZ ao montar — apenas mostra o convite.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isQzConfigured, isQzOnboardingDismissed } from "@/lib/qzPrinterConfig";
import { QzOnboardingDialog } from "./QzOnboardingDialog";

interface Props {
  restaurantId: string;
}

export const QzOnboardingGate = ({ restaurantId }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      // Já configurou ou dispensou nesta sessão? Não mostra.
      if (isQzConfigured() || isQzOnboardingDismissed()) return;

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
