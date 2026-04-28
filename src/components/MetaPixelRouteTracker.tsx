import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/metaPixel";

/**
 * Dispara PageView do Meta Pixel a cada mudança de rota (SPA).
 * O PageView inicial já é disparado pelo init em main.tsx.
 */
export function MetaPixelRouteTracker() {
  const location = useLocation();
  useEffect(() => {
    // Evita disparo duplicado do PageView inicial
    if ((window as any).__meta_pixel_first_pv_skipped) {
      trackPageView();
    } else {
      (window as any).__meta_pixel_first_pv_skipped = true;
    }
  }, [location.pathname]);
  return null;
}
