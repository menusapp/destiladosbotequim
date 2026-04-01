import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface KioskConfig {
  id: string;
  enabled: boolean;
  payment_cash: boolean;
  payment_card: boolean;
  payment_pix: boolean;
  payment_online: boolean;
  order_dine_in: boolean;
  order_takeaway: boolean;
  order_pickup: boolean;
  order_delivery: boolean;
  require_cpf: boolean;
  loyalty_enabled: boolean;
  coupons_enabled: boolean;
  promotions_enabled: boolean;
  inactivity_timeout_seconds: number;
}

export function useKioskConfig(restaurantId: string | null) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from("kiosk_config")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (error) {
          console.error("[useKioskConfig] Error:", error);
        }
        setConfig(data as KioskConfig | null);
      } catch (err) {
        console.error("[useKioskConfig] Exception:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [restaurantId]);

  return { config, loading };
}
