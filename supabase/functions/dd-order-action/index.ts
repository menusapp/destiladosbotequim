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
      // ALWAYS return 200 so client can read error body
      return new Response(JSON.stringify({ error: "restaurant_id, dd_order_id e action são obrigatórios" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    // DD Admin API PUT /orders/{id}/status accepts: APPROVED, IN_TRANSIT, DONE, REJECTED, CANCELLED
    const actionMap: Record<string, { ddStatus: string; localStatus: string }> = {
      accept:   { ddStatus: "APPROVED",   localStatus: "accepted" },
      dispatch: { ddStatus: "IN_TRANSIT", localStatus: "out_for_delivery" },
      ready:    { ddStatus: "APPROVED",   localStatus: "ready" },
      deliver:  { ddStatus: "DONE",       localStatus: "delivered" },
      reject:   { ddStatus: "CANCELLED",  localStatus: "cancelled" },
    };

    const actionConfig = actionMap[action];
    if (!actionConfig) {
      return new Response(JSON.stringify({ error: `Ação inválida: ${action}. Ações válidas: accept, dispatch, ready, deliver, reject` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build request ───────────────────────────────────────────────────
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
      "X-DeliveryDireto-Id": config.store_id,
    };

    // Try multiple endpoints/payloads for maximum compatibility
    const statusUrl = `${DD_ADMIN_API}/orders/${dd_order_id}/status`;
    const orderUrl = `${DD_ADMIN_API}/orders/${dd_order_id}`;

    const body: Record<string, string> = { status: actionConfig.ddStatus };
    if (action === "reject" && reason) {
      body.statusReason = reason;
    }

    console.log(`[dd-order-action] Attempt 1: PUT ${statusUrl}`);
    console.log(`[dd-order-action] Body: ${JSON.stringify(body)}`);

    let apiRes = await fetch(statusUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    let apiText = await apiRes.text();
    console.log(`[dd-order-action] Response 1: status=${apiRes.status}, body=${apiText.substring(0, 500)}`);

    // If /status endpoint fails, try fallback endpoints
    if (!apiRes.ok && apiRes.status !== 204 && apiRes.status !== 202) {
      // Fallback 1: Try with "REJECTED" instead of "CANCELLED" for cancel
      if (action === "reject" && actionConfig.ddStatus === "CANCELLED") {
        console.log(`[dd-order-action] Attempt 2: trying REJECTED instead of CANCELLED`);
        const body2 = { ...body, status: "REJECTED" };
        const res2 = await fetch(statusUrl, { method: "PUT", headers, body: JSON.stringify(body2) });
        const text2 = await res2.text();
        console.log(`[dd-order-action] Response 2: status=${res2.status}, body=${text2.substring(0, 500)}`);
        if (res2.ok || res2.status === 204 || res2.status === 202) {
          apiRes = res2;
          apiText = text2;
        }
      }

      // Fallback 2: Try PUT /orders/{id} without /status
      if (!apiRes.ok && apiRes.status !== 204 && apiRes.status !== 202) {
        if (apiRes.status === 404 || apiRes.status === 405) {
          console.log(`[dd-order-action] Attempt 3: PUT ${orderUrl} (fallback without /status)`);
          const res3 = await fetch(orderUrl, { method: "PUT", headers, body: JSON.stringify(body) });
          const text3 = await res3.text();
          console.log(`[dd-order-action] Response 3: status=${res3.status}, body=${text3.substring(0, 500)}`);
          if (res3.ok || res3.status === 204 || res3.status === 202) {
            apiRes = res3;
            apiText = text3;
          }
        }
      }

      // Fallback 3: Try POST instead of PUT
      if (!apiRes.ok && apiRes.status !== 204 && apiRes.status !== 202) {
        console.log(`[dd-order-action] Attempt 4: POST ${statusUrl}`);
        const res4 = await fetch(statusUrl, { method: "POST", headers, body: JSON.stringify(body) });
        const text4 = await res4.text();
        console.log(`[dd-order-action] Response 4: status=${res4.status}, body=${text4.substring(0, 500)}`);
        if (res4.ok || res4.status === 204 || res4.status === 202) {
          apiRes = res4;
          apiText = text4;
        }
      }
    }

    // Final result check
    const ddSuccess = apiRes.ok || apiRes.status === 204 || apiRes.status === 202;

    if (!ddSuccess) {
      // Parse DD error for user-friendly message
      let ddErrorMsg = "";
      try {
        const errJson = JSON.parse(apiText);
        ddErrorMsg = errJson.message || errJson.error || errJson.detail || apiText.substring(0, 200);
      } catch {
        ddErrorMsg = apiText.substring(0, 200);
      }

      const friendlyError = `Delivery Direto recusou a ação "${action}" (HTTP ${apiRes.status}): ${ddErrorMsg}`;
      console.error(`[dd-order-action] ${friendlyError}`);

      // ALWAYS return 200 so client reads error body, but include dd_error flag
      // Still update local status since user wants the change
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
        .eq("dd_order_id", String(dd_order_id));

      if (updateError) {
        console.error("[dd-order-action] Local status update error:", updateError);
      } else {
        console.log(`[dd-order-action] ✓ Local status updated to ${actionConfig.localStatus} (DD sync failed)`);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        dd_error: true,
        error: friendlyError,
        local_updated: !updateError,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DD accepted - Update local order status ─────────────────────────
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
      .eq("dd_order_id", String(dd_order_id));

    if (updateError) {
      console.error("[dd-order-action] Local status update error:", updateError);
    } else {
      console.log(`[dd-order-action] ✓ Local status updated to ${actionConfig.localStatus}`);
    }

    console.log(`[dd-order-action] ✓ Status ${action} → ${actionConfig.ddStatus} sent successfully for order ${dd_order_id}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dd-order-action] Unexpected error:", err);
    // ALWAYS return 200 so client reads error body
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
