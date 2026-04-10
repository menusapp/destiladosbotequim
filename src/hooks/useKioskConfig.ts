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

export interface KioskPointTerminal {
  device_id: string;
  device_name: string | null;
  mp_store_id: string | null;
  mp_pos_id: string | null;
}

export function useKioskConfig(restaurantId: string | null) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [pointTerminal, setPointTerminal] = useState<KioskPointTerminal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        // Fetch kiosk config
        const { data, error } = await supabase
          .from("kiosk_config")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (error) {
          console.error("[useKioskConfig] Error:", error);
        }
        setConfig(data as KioskConfig | null);

        // Fetch active point terminal
        const { data: terminalData } = await supabase.rpc("get_kiosk_point_terminal", {
          p_restaurant_id: restaurantId,
        });
        if (terminalData && terminalData.length > 0) {
          setPointTerminal(terminalData[0] as KioskPointTerminal);
        }
      } catch (err) {
        console.error("[useKioskConfig] Exception:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [restaurantId]);

  return { config, pointTerminal, loading };
}
