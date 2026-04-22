import { supabase } from "@/integrations/supabase/client";

interface NotifyOrderAcceptedParams {
  restaurantId: string;
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
}

/**
 * Triggers the WhatsApp "order_accepted" notification for orders created via PDV.
 * PDV orders skip the pending->accepted transition (they are inserted with status
 * "preparing"/"accepted" directly), so the regular DB-driven notification trigger
 * never fires. This helper invokes the notification edge function manually.
 *
 * Fail-safe: any error is swallowed so it never breaks order creation.
 */
export async function notifyOrderAcceptedFromPDV({
  restaurantId,
  orderId,
  customerName,
  customerPhone,
}: NotifyOrderAcceptedParams): Promise<void> {
  try {
    const phone = (customerPhone || "").replace(/\D/g, "");
    if (!phone) return;

    // Check whether this notification type is active for the restaurant
    const { data: notifConfig } = await supabase
      .from("whatsapp_notification_configs")
      .select("is_active")
      .eq("restaurant_id", restaurantId)
      .eq("notification_type", "order_accepted")
      .maybeSingle();

    if (!notifConfig?.is_active) return;

    const shortId = orderId.slice(0, 8).toUpperCase();

    await supabase.functions.invoke("whatsapp-notifications", {
      body: {
        restaurant_id: restaurantId,
        notification_type: "order_accepted",
        context: {
          phone,
          customer_phone: phone,
          order_id: orderId,
          numero_pedido: shortId,
          nome: customerName || "Cliente",
          tempo_estimado: "30-45 minutos",
        },
      },
    });
  } catch (err) {
    console.warn("[notifyOrderAcceptedFromPDV] failed:", err);
  }
}
