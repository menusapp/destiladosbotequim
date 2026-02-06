import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("[asaas-webhook] Received event:", JSON.stringify(body));

    const { event, payment } = body;

    if (!event || !payment?.id) {
      console.log("[asaas-webhook] Invalid webhook payload");
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Asaas events to our status
    let newStatus: string | null = null;
    let paidAt: string | null = null;

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        newStatus = "confirmed";
        paidAt = new Date().toISOString();
        break;
      case "PAYMENT_OVERDUE":
        newStatus = "overdue";
        break;
      case "PAYMENT_REFUNDED":
      case "PAYMENT_REFUND_IN_PROGRESS":
        newStatus = "refunded";
        break;
      case "PAYMENT_DELETED":
      case "PAYMENT_RESTORED":
        newStatus = "cancelled";
        break;
      default:
        console.log("[asaas-webhook] Unhandled event type:", event);
        return new Response(
          JSON.stringify({ received: true, handled: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Find the payment record by provider_payment_id
    const { data: onlinePayment, error: findError } = await supabase
      .from("online_payments")
      .select("id, order_id, restaurant_id, status")
      .eq("provider_payment_id", payment.id)
      .maybeSingle();

    if (findError || !onlinePayment) {
      console.error("[asaas-webhook] Payment not found for:", payment.id, findError);
      return new Response(
        JSON.stringify({ received: true, found: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't update if already in final state
    if (onlinePayment.status === "confirmed" && newStatus !== "refunded") {
      console.log("[asaas-webhook] Payment already confirmed, skipping");
      return new Response(
        JSON.stringify({ received: true, already_processed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update online_payments
    const updateData: Record<string, unknown> = {
      status: newStatus,
      webhook_received_at: new Date().toISOString(),
    };
    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    const { error: updateError } = await supabase
      .from("online_payments")
      .update(updateData)
      .eq("id", onlinePayment.id);

    if (updateError) {
      console.error("[asaas-webhook] Error updating online_payments:", updateError);
    }

    // Update order payment_status if payment was confirmed
    if (newStatus === "confirmed" && onlinePayment.order_id) {
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_status: "confirmed",
          online_payment_id: onlinePayment.id,
        })
        .eq("id", onlinePayment.order_id);

      if (orderError) {
        console.error("[asaas-webhook] Error updating order:", orderError);
      }

      // Send WhatsApp notification if configured
      try {
        const { data: order } = await supabase
          .from("orders")
          .select("customer_name, delivery_phone")
          .eq("id", onlinePayment.order_id)
          .maybeSingle();

        if (order?.delivery_phone) {
          const { data: whatsappConfig } = await supabase
            .from("whatsapp_config")
            .select("enabled, instance_status, message_payment_approved")
            .eq("restaurant_id", onlinePayment.restaurant_id)
            .maybeSingle();

          if (whatsappConfig?.enabled && whatsappConfig?.instance_status === "connected" && whatsappConfig?.message_payment_approved) {
            const message = whatsappConfig.message_payment_approved
              .replace(/{nome}/g, order.customer_name || "Cliente")
              .replace(/{pedido}/g, onlinePayment.order_id.slice(0, 8));

            await supabase.functions.invoke("whatsapp-send", {
              body: {
                restaurantId: onlinePayment.restaurant_id,
                phone: order.delivery_phone,
                message,
                orderId: onlinePayment.order_id,
                messageType: "payment_approved",
              },
            });
            console.log("[asaas-webhook] WhatsApp notification sent");
          }
        }
      } catch (whatsappError) {
        console.error("[asaas-webhook] WhatsApp error:", whatsappError);
      }
    }

    console.log("[asaas-webhook] Updated payment", onlinePayment.id, "to status:", newStatus);

    return new Response(
      JSON.stringify({ received: true, status: newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[asaas-webhook] Unexpected error:", error);
    return new Response(
      JSON.stringify({ received: true, error: String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
