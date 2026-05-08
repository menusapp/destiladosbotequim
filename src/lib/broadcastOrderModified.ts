import { supabase } from "@/integrations/supabase/client";

/**
 * Broadcasts a "order-modified" event so other admin sessions receive a
 * "Pedido alterado" notification. Used when items are added or removed
 * from an existing order via PDV/admin flows.
 */
export async function broadcastOrderModified(params: {
  restaurantId: string;
  orderId: string;
  action: "item_added" | "item_removed";
}) {
  try {
    const actorId =
      localStorage.getItem("staff_id") ||
      localStorage.getItem("restaurant_id") ||
      "unknown";

    const channel = supabase.channel(`order-modifications-${params.restaurantId}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
      // Safety timeout
      setTimeout(() => resolve(), 1500);
    });

    await channel.send({
      type: "broadcast",
      event: "order-modified",
      payload: {
        orderId: params.orderId,
        action: params.action,
        actorId,
        at: Date.now(),
      },
    });

    // Cleanup after a short delay so the message has time to flush
    setTimeout(() => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }, 800);
  } catch (e) {
    // Non-blocking — notifications are best-effort
    console.warn("broadcastOrderModified failed:", e);
  }
}
