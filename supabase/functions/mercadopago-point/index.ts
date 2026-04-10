import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MP_API = "https://api.mercadopago.com";

// Known MP error translations
const MP_ERROR_MESSAGES: Record<string, string> = {
  already_queued_order_on_terminal: "Já existe uma cobrança pendente nessa maquininha. Aguarde ou cancele a anterior.",
  device_not_found: "Maquininha não encontrada. Verifique se está ligada.",
  invalid_terminal_id: "Terminal inválido.",
};

function log(action: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), action, ...data }));
}

function respond(ok: boolean, payload: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ ok, ...payload }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
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

  const res = await fetch(`${MP_API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    log("mp_api_error", { path, status: res.status, error_body: data });
  }

  return { ok: res.ok, status: res.status, data };
}

function translateMpError(result: { ok: boolean; status: number; data: any }): { error: string; code: string } {
  const errors = result.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const code = errors[0].code || "unknown";
    const msg = MP_ERROR_MESSAGES[code] || errors[0].message || "Erro desconhecido do Mercado Pago";
    return { error: msg, code };
  }
  const msg = result.data?.message || result.data?.error || `Erro do Mercado Pago (HTTP ${result.status})`;
  return { error: msg, code: "mp_error" };
}

// ============================================
// Actions
// ============================================

async function listTerminals(restaurantId: string) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch("/point/integration-api/devices", accessToken);
  log("list_terminals", { restaurant_id: restaurantId, status: result.ok ? "success" : "error", response_status: result.status });
  if (!result.ok) return respond(false, { ...translateMpError(result), data: null });
  return respond(true, { data: result.data });
}

async function createStore(restaurantId: string, body: { name: string; external_id: string; location: { street_name: string; city_name: string; state_name: string } }) {
  const { accessToken, mpUserId } = await getRestaurantToken(restaurantId);
  if (!mpUserId) return respond(false, { error: "mp_user_id não encontrado", code: "missing_user_id" });
  if (!body.location || !body.location.street_name) {
    return respond(false, { error: "Campo 'location' é obrigatório para criar loja", code: "missing_location" });
  }
  const result = await mpFetch(`/users/${mpUserId}/stores`, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  log("create_store", { restaurant_id: restaurantId, status: result.ok ? "success" : "error", store_id: result.data?.id });
  if (!result.ok) return respond(false, { ...translateMpError(result), data: null });
  return respond(true, { data: result.data });
}

async function createPos(restaurantId: string, body: { name: string; external_id: string; external_store_id: string; fixed_amount?: boolean; category?: number }) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch("/pos", accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  log("create_pos", { restaurant_id: restaurantId, status: result.ok ? "success" : "error", pos_id: result.data?.id });
  if (!result.ok) return respond(false, { ...translateMpError(result), data: null });
  return respond(true, { data: result.data });
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

  let result = await mpFetch("/v1/orders", accessToken, {
    method: "POST",
    body: JSON.stringify(orderPayload),
    headers: { "X-Idempotency-Key": body.idempotency_key },
  });

  // Retry once on 5xx
  if (!result.ok && result.status >= 500) {
    log("create_order_retry", { restaurant_id: restaurantId, order_id: body.order_id, first_status: result.status });
    result = await mpFetch("/v1/orders", accessToken, {
      method: "POST",
      body: JSON.stringify(orderPayload),
      headers: { "X-Idempotency-Key": body.idempotency_key },
    });
  }

  if (!result.ok) {
    log("create_order_result", { restaurant_id: restaurantId, order_id: body.order_id, status: "error", response_status: result.status });
    return respond(false, { ...translateMpError(result), data: null });
  }

  if (result.data?.id) {
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
    status: "success",
    response_status: result.status,
  });

  return respond(true, { data: result.data });
}

async function getOrder(restaurantId: string, mpOrderId: string) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch(`/v1/orders/${mpOrderId}`, accessToken);
  log("get_order", { restaurant_id: restaurantId, mp_order_id: mpOrderId, status: result.ok ? "success" : "error", order_status: result.data?.status });

  if (!result.ok) return respond(false, { ...translateMpError(result), data: null });

  // Update internal status
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

  return respond(true, { data: result.data });
}

async function cancelOrder(restaurantId: string, mpOrderId: string) {
  const { accessToken } = await getRestaurantToken(restaurantId);
  const result = await mpFetch(`/v1/orders/${mpOrderId}`, accessToken, { method: "DELETE" });
  log("cancel_order", { restaurant_id: restaurantId, mp_order_id: mpOrderId, status: result.ok ? "success" : "error" });

  const sb = getSupabaseAdmin();
  await sb.rpc("update_point_order_payment", {
    p_mp_order_id: mpOrderId,
    p_status: "canceled",
    p_mp_status_payload: result.data,
  });

  if (!result.ok) return respond(false, { ...translateMpError(result), data: null });
  return respond(true, { data: result.data });
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
    return respond(false, { error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const body = await req.json();
    const { action, restaurant_id, ...params } = body;

    if (!action || !restaurant_id) {
      return respond(false, { error: "Missing action or restaurant_id", code: "missing_params" });
    }

    switch (action) {
      case "list_terminals":
        return await listTerminals(restaurant_id);
      case "create_store":
        return await createStore(restaurant_id, params as any);
      case "create_pos":
        return await createPos(restaurant_id, params as any);
      case "create_order":
        return await createOrder(restaurant_id, params as any);
      case "get_order":
        return await getOrder(restaurant_id, params.mp_order_id);
      case "cancel_order":
        return await cancelOrder(restaurant_id, params.mp_order_id);
      case "test_order":
        return await testOrder(restaurant_id, params.device_id);
      default:
        return respond(false, { error: `Ação desconhecida: ${action}`, code: "unknown_action" });
    }
  } catch (err: any) {
    const isTokenExpired = err.message === "TOKEN_EXPIRED";
    log("error", { error: err.message, is_token_expired: isTokenExpired });

    return respond(false, {
      error: isTokenExpired
        ? "Token OAuth expirado. Reconecte a conta Mercado Pago."
        : err.message || "Erro interno",
      code: isTokenExpired ? "TOKEN_EXPIRED" : "INTERNAL_ERROR",
    });
  }
});
