import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DD_API_BASE = "https://deliverydireto.com.br/admin-api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { restaurant_id } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const DD_CLIENT_ID = Deno.env.get("DD_CLIENT_ID");
    const DD_CLIENT_SECRET = Deno.env.get("DD_CLIENT_SECRET");

    if (!DD_CLIENT_ID || !DD_CLIENT_SECRET) {
      return new Response(JSON.stringify({ new_orders: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get config
    const { data: config } = await supabase
      .from("deliverydireto_config")
      .select("store_id, access_token, refresh_token, token_expires_at, last_sync_at, enabled")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (!config?.enabled || !config?.store_id) {
      return new Response(JSON.stringify({ new_orders: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check/refresh token
    let accessToken = config.access_token;
    if (config.token_expires_at) {
      const expiresAt = new Date(config.token_expires_at).getTime();
      if (expiresAt < Date.now() + 30 * 60 * 1000) {
        // Token expiring in < 30 min, refresh proactively
        console.log("[dd-polling] Token expiring soon, refreshing...");
        try {
          const refreshRes = await fetch(`${supabaseUrl}/functions/v1/dd-auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refresh_token", restaurant_id }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
            console.log("[dd-polling] Token refreshed successfully");
          } else if (refreshData.expired) {
            console.warn("[dd-polling] Token expired, needs re-auth");
            return new Response(JSON.stringify({ new_orders: 0, expired: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.warn("[dd-polling] Token refresh failed:", e);
        }
      }
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ new_orders: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query URL with updatedAt filter
    const now = new Date();
    const lastSync = config.last_sync_at
      ? new Date(config.last_sync_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: last 24h

    const params = new URLSearchParams();
    params.set("updatedAt[gte]", lastSync.toISOString());
    params.set("limit", "50");

    const ordersUrl = `${DD_API_BASE}/v1/orders?${params.toString()}`;
    console.log(`[dd-polling] Fetching orders: ${ordersUrl}`);

    const ordersRes = await fetch(ordersUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
        "X-DeliveryDireto-Id": config.store_id,
        "Accept": "application/json",
      },
    });

    if (!ordersRes.ok) {
      const errText = await ordersRes.text();
      console.error(`[dd-polling] Orders fetch failed: status=${ordersRes.status}, body=${errText}`);
      return new Response(JSON.stringify({ new_orders: 0, error: "Falha ao buscar pedidos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ordersText = await ordersRes.text();
    console.log(`[dd-polling] Raw response (first 500 chars): ${ordersText.substring(0, 500)}`);
    
    let ordersData: any;
    try {
      ordersData = JSON.parse(ordersText);
    } catch {
      console.error("[dd-polling] Failed to parse response as JSON");
      return new Response(JSON.stringify({ new_orders: 0, error: "Invalid JSON from DD API" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Handle various response shapes from DD API
    let ordersList: any[] = [];
    if (Array.isArray(ordersData)) {
      ordersList = ordersData;
    } else if (ordersData && typeof ordersData === "object") {
      ordersList = ordersData.data || ordersData.orders || ordersData.items || ordersData.results || [];
      if (!Array.isArray(ordersList)) {
        ordersList = [];
      }
    }
    console.log(`[dd-polling] Found ${ordersList.length} orders from DD API`);

    let newOrdersCount = 0;

    for (const ddOrder of ordersList) {
      const ddOrderId = String(ddOrder.id || ddOrder.order_id);

      // Check if already imported
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("dd_order_id", ddOrderId)
        .eq("restaurant_id", restaurant_id)
        .maybeSingle();

      if (existing) {
        // Update status if changed
        const statusMap: Record<string, string> = {
          "PLACED": "pending",
          "CONFIRMED": "accepted",
          "PREPARING": "preparing",
          "READY": "ready",
          "DISPATCHED": "out_for_delivery",
          "DELIVERED": "delivered",
          "CANCELLED": "cancelled",
        };
        const ddStatus = ddOrder.status || "";
        const mappedStatus = statusMap[ddStatus] || null;
        if (mappedStatus) {
          await supabase
            .from("orders")
            .update({ status: mappedStatus })
            .eq("id", existing.id)
            .neq("status", mappedStatus);
        }
        continue;
      }

      // New order - insert
      const customer = ddOrder.customer || {};
      const customerName = customer.name || "Cliente Delivery Direto";
      const customerPhone = customer.phone || "";
      const customerCpf = customer.cpf || customer.document || "";

      const deliveryMethod = ddOrder.delivery_method || ddOrder.deliveryMethod || "";
      const deliveryType = deliveryMethod === "PICKUP" ? "retirada" : "delivery";

      const addr = ddOrder.delivery_address || ddOrder.deliveryAddress || null;
      const deliveryAddress = addr
        ? `${addr.street || ""}, ${addr.number || ""} - ${addr.neighborhood || ""}, ${addr.city || ""}`
        : null;

      const payment = ddOrder.payment || {};
      const paymentType = payment.prepaid ? "Pago pelo Delivery Direto" : (payment.method || "Delivery Direto");

      const statusMap2: Record<string, string> = {
        "PLACED": "pending",
        "CONFIRMED": "accepted",
        "PREPARING": "preparing",
        "READY": "ready",
        "DISPATCHED": "out_for_delivery",
        "DELIVERED": "delivered",
        "CANCELLED": "cancelled",
      };
      const orderStatus = statusMap2[ddOrder.status || "PLACED"] || "pending";

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id,
          customer_name: customerName,
          customer_cpf: customerCpf,
          delivery_type: deliveryType,
          order_type: deliveryType,
          delivery_address: deliveryAddress,
          delivery_phone: customerPhone,
          payment_type: paymentType,
          status: orderStatus,
          dd_source: true,
          dd_order_id: ddOrderId,
          delivery_fee: ddOrder.delivery_fee || ddOrder.deliveryFee || 0,
          notes: ddOrder.observations || null,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`[dd-polling] Error inserting order ${ddOrderId}:`, orderError);
        continue;
      }

      // Insert items
      const items = ddOrder.items || [];
      if (items.length > 0 && newOrder) {
        const orderItems = items.map((item: any) => ({
          order_id: newOrder.id,
          product_id: null,
          quantity: item.quantity || 1,
          price_at_order: item.unit_price || item.unitPrice || item.price || 0,
          notes: item.observations || item.name || null,
        }));

        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) {
          console.error(`[dd-polling] Error inserting items for order ${ddOrderId}:`, itemsError);
        }
      }

      newOrdersCount++;
      console.log(`[dd-polling] New order imported: ${ddOrderId} -> ${newOrder?.id}`);
    }

    // Update last_sync_at
    await supabase
      .from("deliverydireto_config")
      .update({ last_sync_at: now.toISOString() })
      .eq("restaurant_id", restaurant_id);

    console.log(`[dd-polling] Done. New orders: ${newOrdersCount}`);
    return new Response(JSON.stringify({ success: true, new_orders: newOrdersCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dd-polling] Unexpected error:", err);
    return new Response(JSON.stringify({ new_orders: 0, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
