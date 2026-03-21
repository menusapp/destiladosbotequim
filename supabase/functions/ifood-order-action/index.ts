import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IFOOD_API = "https://merchant-api.ifood.com.br";

const ACTION_MAP: Record<string, { method: string; path: string; newStatus?: string }> = {
  confirm: { method: "POST", path: "confirm", newStatus: "accepted" },
  start_preparation: { method: "POST", path: "startPreparation", newStatus: "preparing" },
  ready_to_pickup: { method: "POST", path: "readyToPickup", newStatus: "ready" },
  dispatch: { method: "POST", path: "dispatch", newStatus: "out_for_delivery" },
  cancel: { method: "POST", path: "requestCancellation", newStatus: "cancelled" },
  get_cancellation_reasons: { method: "GET", path: "cancellationReasons" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurant_id, ifood_order_id, order_id, action, cancellation_code } = await req.json();

    if (!restaurant_id || !ifood_order_id || !action) {
      return new Response(
        JSON.stringify({ error: "restaurant_id, ifood_order_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actionConfig = ACTION_MAP[action];
    if (!actionConfig) {
      return new Response(
        JSON.stringify({ error: `Invalid action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get token
    const { data: config } = await supabase
      .from("ifood_config")
      .select("access_token")
      .eq("restaurant_id", restaurant_id)
      .single();

    if (!config?.access_token) {
      return new Response(
        JSON.stringify({ error: "iFood not connected" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build request
    const url = `${IFOOD_API}/order/v1.0/orders/${ifood_order_id}/${actionConfig.path}`;
    const fetchOptions: RequestInit = {
      method: actionConfig.method,
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
    };

    // Add cancellation body if needed
    if (action === "cancel" && cancellation_code) {
      fetchOptions.body = JSON.stringify({ cancellationCode: cancellation_code });
    }

    const response = await fetch(url, fetchOptions);

    if (action === "get_cancellation_reasons") {
      const reasons = response.ok ? await response.json() : [];
      return new Response(
        JSON.stringify({ reasons }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `iFood action failed: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update local order status
    if (actionConfig.newStatus && order_id) {
      await supabase
        .from("orders")
        .update({ status: actionConfig.newStatus })
        .eq("id", order_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ifood-order-action error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
