import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MP_API = "https://api.mercadopago.com";

function log(action: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), action, ...data }));
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getRestaurantToken(restaurantId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("online_payment_config")
    .select("mp_access_token, mp_user_id, token_expires_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data?.mp_access_token) {
    throw new Error("Conta Mercado Pago não conectada para este restaurante");
  }

  // Check token expiry
  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
    throw new Error("TOKEN_EXPIRED");
  }

  return { accessToken: data.mp_access_token, mpUserId: data.mp_user_id };
}

async function mpFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  // Log full MP error body for debugging
  if (!res.ok) {
    log("mp_api_error", { path, status: res.status, error_body: data });
  }

  return { ok: res.ok, status: res.status, data };
}

// ============================================
// Actions
// ============================================

async function listTerminals(restaurantId: string) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch("/point/integration-api/devices", accessToken);
  log("list_terminals", { restaurant_id: restaurantId, status: result.ok ? "success" : "error", response_status: result.status });
  return result;
}

async function createStore(restaurantId: string, body: { name: string; external_id: string; location: { street_name: string; city_name: string; state_name: string } }) {
  const { accessToken, mpUserId } = await getRestaurantToken(restaurantId);
  if (!mpUserId) throw new Error("mp_user_id não encontrado");
  if (!body.location || !body.location.street_name) {
    throw new Error("Campo 'location' é obrigatório para criar loja");
  }
  const result = await mpFetch(`/users/${mpUserId}/stores`, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  log("create_store", { restaurant_id: restaurantId, status: result.ok ? "success" : "error", store_id: result.data?.id });
  return result;
}

async function createPos(restaurantId: string, body: { name: string; external_id: string; external_store_id: string; fixed_amount?: boolean; category?: number }) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch("/pos", accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  log("create_pos", { restaurant_id: restaurantId, status: result.ok ? "success" : "error", pos_id: result.data?.id });
  return result;
}

async function createOrder(
  restaurantId: string,
  body: { amount: number; description: string; order_id: string; device_id: string; idempotency_key: string }
) {
  const { accessToken, mpUserId } = await getRestaurantToken(restaurantId);

  const orderPayload = {
    type: "point",
    external_reference: body.order_id,
    description: body.description,
    transactions: {
      payments: [{ amount: body.amount.toString() }],
    },
    config: {
      point: {
        terminal_id: body.device_id,
        print_on_terminal: "no_ticket",
      },
    },
  };

  log("create_order", {
    restaurant_id: restaurantId,
    order_id: body.order_id,
    terminal_id: body.device_id,
    amount: body.amount,
    idempotency_key: body.idempotency_key,
  });

  // First attempt
  let result = await mpFetch("/v1/orders", accessToken, {
    method: "POST",
    body: JSON.stringify(orderPayload),
    headers: { "X-Idempotency-Key": body.idempotency_key },
  });

  // Retry once on network-level failure
  if (!result.ok && result.status >= 500) {
    log("create_order_retry", { restaurant_id: restaurantId, order_id: body.order_id, first_status: result.status });
    result = await mpFetch("/v1/orders", accessToken, {
      method: "POST",
      body: JSON.stringify(orderPayload),
      headers: { "X-Idempotency-Key": body.idempotency_key },
    });
  }

  if (result.ok && result.data?.id) {
    // Save to point_order_payments via RPC
    const sb = getSupabaseAdmin();
    await sb.rpc("insert_point_order_payment", {
      p_restaurant_id: restaurantId,
      p_order_id: body.order_id,
      p_mp_order_id: result.data.id,
      p_mp_user_id: mpUserId || "",
      p_terminal_id: body.device_id,
      p_external_reference: body.order_id,
      p_idempotency_key: body.idempotency_key,
      p_amount: body.amount,
      p_status: "waiting_terminal",
    });
  }

  log("create_order_result", {
    restaurant_id: restaurantId,
    order_id: body.order_id,
    mp_order_id: result.data?.id,
    status: result.ok ? "success" : "error",
    response_status: result.status,
  });

  return result;
}

async function getOrder(restaurantId: string, mpOrderId: string) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch(`/v1/orders/${mpOrderId}`, accessToken);
  log("get_order", { restaurant_id: restaurantId, mp_order_id: mpOrderId, status: result.ok ? "success" : "error", order_status: result.data?.status });

  // Update internal status if processed
  if (result.ok && result.data) {
    const sb = getSupabaseAdmin();
    const mpStatus = result.data.status;
    let internalStatus = "waiting_terminal";

    if (mpStatus === "processed") {
      const txn = result.data.transactions?.payments?.[0];
      if (txn?.status_detail === "accredited" || txn?.status === "approved") {
        internalStatus = "paid";
      } else {
        internalStatus = "failed";
      }
    } else if (mpStatus === "canceled" || mpStatus === "expired") {
      internalStatus = "canceled";
    } else if (mpStatus === "processing") {
      internalStatus = "processing";
    }

    await sb.rpc("update_point_order_payment", {
      p_mp_order_id: mpOrderId,
      p_status: internalStatus,
      p_mp_status_payload: result.data,
    });
  }

  return result;
}

async function cancelOrder(restaurantId: string, mpOrderId: string) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch(`/v1/orders/${mpOrderId}`, accessToken, { method: "DELETE" });
  log("cancel_order", { restaurant_id: restaurantId, mp_order_id: mpOrderId, status: result.ok ? "success" : "error" });

  // Update internal status
  const sb = getSupabaseAdmin();
  await sb.rpc("update_point_order_payment", {
    p_mp_order_id: mpOrderId,
    p_status: "canceled",
    p_mp_status_payload: result.data,
  });

  return result;
}

async function testOrder(restaurantId: string, deviceId: string) {
  return createOrder(restaurantId, {
    amount: 1.0,
    description: "Teste de integração - R$ 1,00",
    order_id: crypto.randomUUID(),
    device_id: deviceId,
    idempotency_key: crypto.randomUUID(),
  });
}

// ============================================
// Handler
// ============================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, restaurant_id, ...params } = body;

    if (!action || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: "Missing action or restaurant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { ok: boolean; status: number; data: any };

    switch (action) {
      case "list_terminals":
        result = await listTerminals(restaurant_id);
        break;

      case "create_store":
        result = await createStore(restaurant_id, params as any);
        break;

      case "create_pos":
        result = await createPos(restaurant_id, params as any);
        break;

      case "create_order":
        result = await createOrder(restaurant_id, params as any);
        break;

      case "get_order":
        result = await getOrder(restaurant_id, params.mp_order_id);
        break;

      case "cancel_order":
        result = await cancelOrder(restaurant_id, params.mp_order_id);
        break;

      case "test_order":
        result = await testOrder(restaurant_id, params.device_id);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result.data),
      {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    const isTokenExpired = err.message === "TOKEN_EXPIRED";
    log("error", { error: err.message, is_token_expired: isTokenExpired });

    return new Response(
      JSON.stringify({
        error: isTokenExpired
          ? "Token OAuth expirado. Reconecte a conta Mercado Pago."
          : err.message || "Internal error",
        code: isTokenExpired ? "TOKEN_EXPIRED" : "INTERNAL_ERROR",
      }),
      {
        status: isTokenExpired ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
