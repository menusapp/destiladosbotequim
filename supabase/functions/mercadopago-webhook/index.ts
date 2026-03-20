import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[MP Webhook] Received:", JSON.stringify(body));

    // Mercado Pago sends IPN with action and data.id
    const action = body.action || body.type;
    const paymentId = body.data?.id;

    if (!paymentId) {
      console.log("[MP Webhook] No payment ID, ignoring");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Only process payment updates
    if (action !== "payment.updated" && action !== "payment.created" && action !== "payment") {
      console.log("[MP Webhook] Ignoring action:", action);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the online_payment record by provider_payment_id
    const { data: onlinePayment, error: findError } = await supabase
      .from("online_payments")
      .select("id, restaurant_id, order_id, status, amount")
      .eq("provider_payment_id", String(paymentId))
      .maybeSingle();

    if (findError || !onlinePayment) {
      console.log("[MP Webhook] Payment not found for MP id:", paymentId);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Already confirmed, skip
    if (onlinePayment.status === "confirmed") {
      console.log("[MP Webhook] Already confirmed:", onlinePayment.id);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Fetch payment details from Mercado Pago to verify status
    // We need the restaurant's access token
    const { data: config } = await supabase
      .from("online_payment_config")
      .select("mp_access_token")
      .eq("restaurant_id", onlinePayment.restaurant_id)
      .maybeSingle();

    if (!config?.mp_access_token) {
      console.error("[MP Webhook] No access token for restaurant:", onlinePayment.restaurant_id);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Verify payment status with MP API
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${config.mp_access_token}` },
    });
    const mpPayment = await mpResponse.json();

    console.log("[MP Webhook] MP status:", mpPayment.status, "for payment:", onlinePayment.id);

    if (mpPayment.status === "approved") {
      // Update online_payments to confirmed
      const { error: updateError } = await supabase
        .from("online_payments")
        .update({
          status: "confirmed",
          paid_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString(),
        })
        .eq("id", onlinePayment.id);

      if (updateError) {
        console.error("[MP Webhook] Update error:", updateError);
      } else {
        console.log("[MP Webhook] Payment confirmed:", onlinePayment.id);

        // Update order payment status if linked
        if (onlinePayment.order_id) {
          await supabase
            .from("orders")
            .update({ payment_status: "paid" })
            .eq("id", onlinePayment.order_id);
        }

        // 🔥 Trigger NFC-e emission via Nuvem Fiscal
        try {
          const nfceUrl = `${supabaseUrl}/functions/v1/nuvem-fiscal-emit`;
          const nfceResponse = await fetch(nfceUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              order_id: onlinePayment.order_id,
              restaurant_id: onlinePayment.restaurant_id,
            }),
          });
          const nfceResult = await nfceResponse.text();
          console.log("[MP Webhook] Nuvem Fiscal response:", nfceResult);
        } catch (nfceError: any) {
          console.error("[MP Webhook] Nuvem Fiscal call failed:", nfceError.message);
          // Don't fail the webhook because of NFC-e errors
        }
      }
    } else if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
      await supabase
        .from("online_payments")
        .update({
          status: "failed",
          webhook_received_at: new Date().toISOString(),
        })
        .eq("id", onlinePayment.id);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("[MP Webhook] Error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
