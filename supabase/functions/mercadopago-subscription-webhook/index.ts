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

      // Find restaurant by external_reference (restaurant_id) or mp_payer_email
      let restaurantId: string | null = null;

      if (externalRef) {
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
        // Try to update existing pending_payment subscription first
        const { data: existingSub } = await (supabase.from("restaurant_subscriptions" as any) as any)
          .select("id")
          .eq("restaurant_id", restaurantId)
          .in("status", ["pending_payment", "suspended"])
          .maybeSingle();

        if (existingSub) {
          // Update existing subscription to active
          const nextPayment = new Date();
          nextPayment.setMonth(nextPayment.getMonth() + 1);

          await (supabase.from("restaurant_subscriptions" as any) as any)
            .update({
              status: "active",
              last_payment_at: new Date().toISOString(),
              next_payment_at: nextPayment.toISOString(),
              mp_preapproval_id: String(dataId),
              failed_payments: 0,
            })
            .eq("id", existingSub.id);

          console.log("[MP Sub Webhook] Existing subscription activated for restaurant:", restaurantId);
        } else {
          // Cancel any other active subscriptions
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
            failed_payments: 0,
          });

          console.log("[MP Sub Webhook] New subscription created for restaurant:", restaurantId);
        }

        // Clear pending_plan_slug and update payer email
        const updateData: any = { pending_plan_slug: null };
        if (payerEmail) updateData.mp_payer_email = payerEmail;
        await supabase.from("restaurants").update(updateData).eq("id", restaurantId);

        // Clear trial flags if any
        await supabase.from("restaurants").update({
          trial_expired: false,
          trial_started_at: null,
          trial_ends_at: null,
        }).eq("id", restaurantId);

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

      const preapprovalId = payment.metadata?.preapproval_id;
      const externalRef = payment.external_reference;

      if (payment.status === "approved") {
        const nextPayment = new Date();
        nextPayment.setMonth(nextPayment.getMonth() + 1);

        // Try matching by preapproval_id first, then external_reference
        if (preapprovalId) {
          await (supabase.from("restaurant_subscriptions" as any) as any)
            .update({
              status: "active",
              last_payment_at: new Date().toISOString(),
              next_payment_at: nextPayment.toISOString(),
              failed_payments: 0,
            })
            .eq("mp_preapproval_id", String(preapprovalId));

          console.log("[MP Sub Webhook] Payment renewed for preapproval:", preapprovalId);
        } else if (externalRef) {
          await (supabase.from("restaurant_subscriptions" as any) as any)
            .update({
              status: "active",
              last_payment_at: new Date().toISOString(),
              next_payment_at: nextPayment.toISOString(),
              failed_payments: 0,
            })
            .eq("restaurant_id", externalRef)
            .in("status", ["pending_payment", "active", "suspended"]);

          console.log("[MP Sub Webhook] Payment activated for restaurant:", externalRef);
        }
      } else if (payment.status === "rejected" || payment.status === "refunded") {
        // Increment failed_payments
        let matchField = "";
        let matchValue = "";

        if (preapprovalId) {
          matchField = "mp_preapproval_id";
          matchValue = String(preapprovalId);
        } else if (externalRef) {
          matchField = "restaurant_id";
          matchValue = externalRef;
        }

        if (matchField) {
          // Get current failed_payments count
          const { data: sub } = await (supabase.from("restaurant_subscriptions" as any) as any)
            .select("id, failed_payments")
            .eq(matchField, matchValue)
            .in("status", ["active", "pending_payment"])
            .maybeSingle();

          if (sub) {
            const newFailedCount = (sub.failed_payments || 0) + 1;
            const newStatus = newFailedCount >= 2 ? "suspended" : sub.status || "active";

            await (supabase.from("restaurant_subscriptions" as any) as any)
              .update({
                failed_payments: newFailedCount,
                status: newStatus,
              })
              .eq("id", sub.id);

            console.log("[MP Sub Webhook] Payment rejected. Failed count:", newFailedCount, "New status:", newStatus);
          }
        }
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("[MP Sub Webhook] Error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
