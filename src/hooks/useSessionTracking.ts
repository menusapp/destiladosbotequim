import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CartItem } from "@/types/menu";

const SESSION_KEY = "delivery-session-token";

function getOrCreateSessionToken(): string {
  let token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, token);
  }
  return token;
}

export function useSessionTracking(restaurantId: string | undefined) {
  const sessionToken = useRef(getOrCreateSessionToken());
  const lastStatus = useRef<string>("");

  const updateSession = useCallback(
    async (fields: Record<string, any>) => {
      if (!restaurantId) return;
      try {
        const token = sessionToken.current;
        // Try update first
        const { data } = await supabase
          .from("customer_sessions" as any)
          .update({ ...fields, last_activity: new Date().toISOString() } as any)
          .eq("session_token", token)
          .eq("restaurant_id", restaurantId)
          .select("id")
          .maybeSingle();

        if (!data) {
          await supabase.from("customer_sessions" as any).insert({
            restaurant_id: restaurantId,
            session_token: token,
            ...fields,
          } as any);
        }
      } catch (e) {
        // Silent - never block navigation
      }
    },
    [restaurantId]
  );

  // Track page load - create browsing session
  useEffect(() => {
    if (!restaurantId) return;
    updateSession({ status: "browsing" });
    lastStatus.current = "browsing";
  }, [restaurantId, updateSession]);

  const trackCartUpdate = useCallback(
    (cart: CartItem[]) => {
      if (!restaurantId || cart.length === 0) return;
      const cartValue = cart.reduce((sum, item) => {
        const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
        const price = item.product.promotional_price ?? item.product.price;
        return sum + (price + extrasTotal) * item.quantity;
      }, 0);

      const cartSnapshot = cart.map((item) => ({
        name: item.product.name,
        qty: item.quantity,
        price: item.product.promotional_price ?? item.product.price,
      }));

      if (lastStatus.current !== "cart_added") {
        lastStatus.current = "cart_added";
      }

      updateSession({
        status: "cart_added",
        cart_items: cartSnapshot,
        cart_value: Math.round(cartValue * 100) / 100,
      });
    },
    [restaurantId, updateSession]
  );

  const trackCheckoutStarted = useCallback(() => {
    if (lastStatus.current === "checkout_started") return;
    lastStatus.current = "checkout_started";
    updateSession({ status: "checkout_started" });
  }, [updateSession]);

  const trackCompleted = useCallback(() => {
    lastStatus.current = "completed";
    updateSession({ status: "completed", cart_items: [], cart_value: 0 });
  }, [updateSession]);

  const trackCustomerInfo = useCallback(
    (phone?: string, name?: string) => {
      const fields: Record<string, any> = {};
      if (phone) fields.phone = phone;
      if (name) fields.name = name;
      if (Object.keys(fields).length > 0) updateSession(fields);
    },
    [updateSession]
  );

  return {
    trackCartUpdate,
    trackCheckoutStarted,
    trackCompleted,
    trackCustomerInfo,
  };
}
