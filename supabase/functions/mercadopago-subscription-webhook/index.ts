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
    const body = await req.json();
    console.log("[MP Sub Webhook] Received:", JSON.stringify(body));

    const action = body.action || body.type;
    const dataId = body.data?.id;

    if (!dataId) {
      console.log("[MP Sub Webhook] No data ID, ignoring");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle subscription_preapproval (subscription status changes)
    if (action === "subscription_preapproval.updated" || action === "subscription_preapproval.created") {
      const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpAccessToken) {
        console.error("[MP Sub Webhook] No MERCADOPAGO_ACCESS_TOKEN configured");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Fetch preapproval details from MP
      const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      const preapproval = await mpResponse.json();

      console.log("[MP Sub Webhook] Preapproval status:", preapproval.status, "payer:", preapproval.payer_email);

      const payerEmail = preapproval.payer_email || preapproval.payer?.email;
      const externalRef = preapproval.external_reference;

      if (!payerEmail && !externalRef) {
        console.log("[MP Sub Webhook] No payer_email or external_reference, can't match restaurant");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Find restaurant by mp_payer_email or external_reference (restaurant_id)
      let restaurantId: string | null = null;

      if (externalRef) {
        // external_reference should be restaurant_id
        const { data: rest } = await supabase
          .from("restaurants")
          .select("id")
          .eq("id", externalRef)
          .maybeSingle();
        if (rest) restaurantId = rest.id;
      }

      if (!restaurantId && payerEmail) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("id")
          .eq("mp_payer_email", payerEmail)
          .maybeSingle();
        if (rest) restaurantId = rest.id;
      }

      if (!restaurantId) {
        console.log("[MP Sub Webhook] Restaurant not found for email:", payerEmail, "ref:", externalRef);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      if (preapproval.status === "authorized" || preapproval.status === "active") {
        // Cancel previous subscriptions
        await supabase
          .from("restaurant_subscriptions" as any)
          .update({ status: "cancelled" })
          .eq("restaurant_id", restaurantId)
          .eq("status", "active");

        // Determine plan based on amount
        const amount = preapproval.auto_recurring?.transaction_amount || 0;
        const { data: plans } = await supabase
          .from("subscription_plans")
          .select("id, price")
          .eq("is_active", true)
          .order("price");

        // Find closest matching plan
        let planId: string | null = null;
        if (plans && plans.length > 0) {
          const closest = plans.reduce((prev: any, curr: any) =>
            Math.abs(curr.price - amount) < Math.abs(prev.price - amount) ? curr : prev
          );
          planId = closest.id;
        }

        if (!planId) {
          console.error("[MP Sub Webhook] No matching plan for amount:", amount);
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        const nextPayment = new Date();
        nextPayment.setMonth(nextPayment.getMonth() + 1);

        await (supabase.from("restaurant_subscriptions" as any) as any).insert({
          restaurant_id: restaurantId,
          plan_id: planId,
          status: "active",
          last_payment_at: new Date().toISOString(),
          next_payment_at: nextPayment.toISOString(),
          mp_preapproval_id: String(dataId),
        });

        // Update restaurant's payer email
        if (payerEmail) {
          await supabase
            .from("restaurants")
            .update({ mp_payer_email: payerEmail })
            .eq("id", restaurantId);
        }

        console.log("[MP Sub Webhook] Subscription activated for restaurant:", restaurantId);
      } else if (preapproval.status === "paused" || preapproval.status === "cancelled") {
        // Suspend subscription
        await (supabase.from("restaurant_subscriptions" as any) as any)
          .update({ status: "suspended" })
          .eq("restaurant_id", restaurantId)
          .eq("mp_preapproval_id", String(dataId));

        console.log("[MP Sub Webhook] Subscription suspended for restaurant:", restaurantId);
      }
    }

    // Handle subscription_authorized_payment (recurring payment made)
    if (action === "subscription_authorized_payment.created" || action === "payment") {
      const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpAccessToken) {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Fetch payment details
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      const payment = await mpResponse.json();

      if (payment.status === "approved" && payment.metadata?.preapproval_id) {
        const preapprovalId = payment.metadata.preapproval_id;

        const nextPayment = new Date();
        nextPayment.setMonth(nextPayment.getMonth() + 1);

        await (supabase.from("restaurant_subscriptions" as any) as any)
          .update({
            status: "active",
            last_payment_at: new Date().toISOString(),
            next_payment_at: nextPayment.toISOString(),
          })
          .eq("mp_preapproval_id", String(preapprovalId));

        console.log("[MP Sub Webhook] Payment renewed for preapproval:", preapprovalId);
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("[MP Sub Webhook] Error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
