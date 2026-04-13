import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Expire trial subscriptions that are past due
    const { data: expiredSubs, error: subError } = await supabase
      .from("restaurant_subscriptions")
      .select("id, restaurant_id")
      .eq("is_trial", true)
      .eq("status", "active")
      .lt("trial_ends_at", new Date().toISOString());

    if (subError) {
      console.error("[check-trial-expiry] Error fetching expired trials:", subError);
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      console.log("[check-trial-expiry] No expired trials found");
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const restaurantIds = expiredSubs.map((s) => s.restaurant_id);
    const subIds = expiredSubs.map((s) => s.id);

    // Update subscriptions to expired
    const { error: updateSubError } = await supabase
      .from("restaurant_subscriptions")
      .update({ status: "expired" })
      .in("id", subIds);

    if (updateSubError) {
      console.error("[check-trial-expiry] Error updating subscriptions:", updateSubError);
    }

    // Update restaurants to trial_expired
    const { error: updateRestError } = await supabase
      .from("restaurants")
      .update({ trial_expired: true })
      .in("id", restaurantIds);

    if (updateRestError) {
      console.error("[check-trial-expiry] Error updating restaurants:", updateRestError);
    }

    console.log(`[check-trial-expiry] Expired ${expiredSubs.length} trials`);

    return new Response(
      JSON.stringify({ expired: expiredSubs.length, restaurant_ids: restaurantIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-trial-expiry] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
