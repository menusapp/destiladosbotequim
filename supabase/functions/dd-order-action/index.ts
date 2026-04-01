import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DD_ADMIN_API = "https://deliverydireto.com.br/admin-api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { restaurant_id, dd_order_id, action, reason } = await req.json();
    console.log(`[dd-order-action] action=${action}, dd_order_id=${dd_order_id}, restaurant_id=${restaurant_id}`);

    if (!restaurant_id || !dd_order_id || !action) {
      return new Response(JSON.stringify({ error: "restaurant_id, dd_order_id e action são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const DD_CLIENT_ID = Deno.env.get("DD_CLIENT_ID")!;

    // Get config with token
    const { data: config } = await supabase
      .from("deliverydireto_config")
      .select("store_id, access_token, token_expires_at")
      .eq("restaurant_id", restaurant_id)
      .eq("enabled", true)
      .maybeSingle();

    if (!config?.access_token) {
      return new Response(JSON.stringify({ error: "Delivery Direto não conectado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check token expiration and refresh if needed
    let accessToken = config.access_token;
    if (config.token_expires_at) {
      const expiresAt = new Date(config.token_expires_at).getTime();
      if (expiresAt < Date.now() + 5 * 60 * 1000) {
        console.log("[dd-order-action] Token expiring, attempting refresh...");
        try {
          const refreshRes = await fetch(`${supabaseUrl}/functions/v1/dd-auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refresh_token", restaurant_id }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
          } else {
            console.warn("[dd-order-action] Token refresh failed, using existing token");
          }
        } catch (e) {
          console.warn("[dd-order-action] Token refresh error:", e);
        }
      }
    }

    // ── Status mapping: ERP action → DD Admin API status ────────────────
    // Official route: PUT /admin-api/v1/orders/{id}/status
    // Official status enum: APPROVED, IN_TRANSIT, DONE, REJECTED
    const actionMap: Record<string, { ddStatus: string; localStatus: string }> = {
      accept:   { ddStatus: "APPROVED",   localStatus: "accepted" },
      dispatch: { ddStatus: "IN_TRANSIT", localStatus: "out_for_delivery" },
      deliver:  { ddStatus: "DONE",       localStatus: "delivered" },
      reject:   { ddStatus: "REJECTED",   localStatus: "cancelled" },
    };

    const actionConfig = actionMap[action];
    if (!actionConfig) {
      return new Response(JSON.stringify({ error: `Ação inválida: ${action}. Ações válidas: accept, dispatch, deliver, reject` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build request ───────────────────────────────────────────────────
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
      "X-DeliveryDireto-Id": config.store_id,
    };

    // Official Admin API route: PUT /admin-api/v1/orders/{id}/status
    const statusUrl = `${DD_ADMIN_API}/orders/${dd_order_id}/status`;
    const body: Record<string, string> = { status: actionConfig.ddStatus };
    if (action === "reject" && reason) {
      body.statusReason = reason;
    }

    console.log(`[dd-order-action] PUT ${statusUrl}`);
    console.log(`[dd-order-action] Body: ${JSON.stringify(body)}`);

    const apiRes = await fetch(statusUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const apiText = await apiRes.text();
    console.log(`[dd-order-action] Response: status=${apiRes.status}, body=${apiText.substring(0, 500)}`);

    if (!apiRes.ok && apiRes.status !== 204 && apiRes.status !== 202) {
      // If /orders/{id}/status fails with 404, try fallback PUT /orders/{id}
      if (apiRes.status === 404 || apiRes.status === 405) {
        console.log(`[dd-order-action] /status route returned ${apiRes.status}, trying fallback PUT /orders/${dd_order_id}`);
        const fallbackUrl = `${DD_ADMIN_API}/orders/${dd_order_id}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        const fallbackText = await fallbackRes.text();
        console.log(`[dd-order-action] Fallback response: status=${fallbackRes.status}, body=${fallbackText.substring(0, 500)}`);

        if (!fallbackRes.ok && fallbackRes.status !== 204 && fallbackRes.status !== 202) {
          return new Response(JSON.stringify({ error: `Erro na API DD: ${fallbackRes.status} - ${fallbackText.substring(0, 200)}` }), {
            status: fallbackRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: `Erro na API DD: ${apiRes.status} - ${apiText.substring(0, 200)}` }), {
          status: apiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Update local order status ───────────────────────────────────────
    const updateData: Record<string, any> = {
      status: actionConfig.localStatus,
      updated_at: new Date().toISOString(),
    };
    if (action === "reject" && reason) {
      updateData.cancellation_reason = reason;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("dd_order_id", dd_order_id);

    if (updateError) {
      console.error("[dd-order-action] Local status update error:", updateError);
    } else {
      console.log(`[dd-order-action] ✓ Local status updated to ${actionConfig.localStatus}`);
    }

    console.log(`[dd-order-action] ✓ Status ${action} → ${actionConfig.ddStatus} sent successfully for order ${dd_order_id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dd-order-action] Unexpected error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
