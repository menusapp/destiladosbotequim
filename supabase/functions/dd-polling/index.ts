import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DD_API_BASE = "https://deliverydireto.com.br/admin-api";

// Convert DD Money object (cents) to decimal
function money(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && v.value !== undefined) return v.value / 100;
  if (typeof v === "number") return v / 100;
  return 0;
}

// Map DD payment to local label
function mapPaymentType(payment: any): string {
  if (!payment) return "Delivery Direto";
  const pType = payment.type; // ONLINE or OFFLINE
  const details = payment.paymentDetails || {};
  const detailType = details.type || "";

  if (pType === "ONLINE") return "Pago Delivery Direto";

  // OFFLINE payments
  switch (detailType) {
    case "CASH": return "Dinheiro";
    case "CREDITCARD": {
      const brand = details.brand || details.cardBrand || "";
      return brand ? `Cartão ${brand}` : "Cartão de Crédito";
    }
    case "DEBITCARD": {
      const brand = details.brand || details.cardBrand || "";
      return brand ? `Cartão Débito ${brand}` : "Cartão de Débito";
    }
    case "PIX": return "PIX";
    case "MEAL_VOUCHER": return "Vale Refeição";
    default: return detailType || "Delivery Direto";
  }
}

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
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
    // Log MORE of the response to see items/payment fields
    console.log(`[dd-polling] Raw response (first 3000 chars): ${ordersText.substring(0, 3000)}`);
    
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
    if (ordersData?.data?.orders && Array.isArray(ordersData.data.orders)) {
      ordersList = ordersData.data.orders;
    } else if (Array.isArray(ordersData)) {
      ordersList = ordersData;
    } else if (ordersData?.data && Array.isArray(ordersData.data)) {
      ordersList = ordersData.data;
    } else if (ordersData?.orders && Array.isArray(ordersData.orders)) {
      ordersList = ordersData.orders;
    }
    console.log(`[dd-polling] Found ${ordersList.length} orders from DD API`);

    // Log first order keys and critical fields for debugging
    if (ordersList.length > 0) {
      const first = ordersList[0];
      console.log(`[dd-polling] First order keys: ${Object.keys(first).join(", ")}`);
      console.log(`[dd-polling] First order FULL (3000): ${JSON.stringify(first).substring(0, 3000)}`);
      
      // Log items field specifically
      const itemsField = first.items || first.orderItems || first.cart || first.products || first.orderProducts;
      console.log(`[dd-polling] Items field found: ${itemsField ? `yes (${Array.isArray(itemsField) ? itemsField.length : 'not array'})` : 'NO - check keys above'}`);
      if (itemsField && Array.isArray(itemsField) && itemsField.length > 0) {
        console.log(`[dd-polling] First item keys: ${Object.keys(itemsField[0]).join(", ")}`);
        console.log(`[dd-polling] First item FULL: ${JSON.stringify(itemsField[0]).substring(0, 1000)}`);
      }
      
      // Log payment field specifically
      const payField = first.payment || first.payments || first.paymentMethod;
      console.log(`[dd-polling] Payment field: ${JSON.stringify(payField).substring(0, 500)}`);
    }

    const statusMap: Record<string, string> = {
      "WAITING": "pending",
      "APPROVED": "accepted",
      "PREPARING": "preparing",
      "READY": "ready",
      "DISPATCHED": "out_for_delivery",
      "DONE": "delivered",
      "CANCELLED": "cancelled",
      "PLACED": "pending",
      "CONFIRMED": "accepted",
      "DELIVERED": "delivered",
    };

    // Pre-fetch all products with pdv_code for matching
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, pdv_code, price")
      .eq("restaurant_id", restaurant_id);
    const productsList = allProducts || [];

    let newOrdersCount = 0;

    for (const ddOrder of ordersList) {
      const ddOrderId = String(ddOrder.orderNumber || ddOrder.id || ddOrder.order_id || "");
      if (!ddOrderId) continue;

      // Check if already imported
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("dd_order_id", ddOrderId)
        .eq("restaurant_id", restaurant_id)
        .maybeSingle();

      if (existing) {
        // Update status if changed
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

      // New order - extract fields
      const customer = ddOrder.customer || {};
      const customerName = customer.name || customer.firstName
        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
        : "Cliente Delivery Direto";
      const customerPhone = customer.phone || customer.phones?.[0] || "";
      const customerCpf = customer.cpf || customer.document || customer.taxPayerIdentificationNumber || "";

      // Order type mapping
      const ddType = ddOrder.type || ddOrder.delivery_method || ddOrder.deliveryMethod || "";
      const isPickup = ddType === "TAKEOUT" || ddType === "PICKUP";
      const deliveryType = isPickup ? "pickup" : "delivery";

      // Address
      const addr = ddOrder.delivery_address || ddOrder.deliveryAddress || ddOrder.address || null;
      const deliveryAddress = addr
        ? `${addr.street || addr.streetName || ""}, ${addr.number || ""} - ${addr.neighborhood || addr.district || ""}, ${addr.city || ""}`
        : null;

      // Payment mapping - try multiple field names
      const payment = ddOrder.payment || (Array.isArray(ddOrder.payments) ? ddOrder.payments[0] : null) || ddOrder.paymentMethod || ddOrder.paymentDetails || {};
      const paymentType = mapPaymentType(payment);
      console.log(`[dd-polling] Order ${ddOrderId} payment raw: ${JSON.stringify(payment).substring(0, 300)}, mapped: ${paymentType}`);

      // Status
      const orderStatus = statusMap[ddOrder.status || "WAITING"] || "pending";

      // Prices - DD returns values in CENTS, ALWAYS divide by 100
      const values = ddOrder.total || ddOrder.values || {};
      const deliveryFee = money(values.deliveryFee || values.delivery_fee || ddOrder.delivery_fee || ddOrder.deliveryFee);
      const subtotal = money(values.subTotal || values.subtotal);

      // Scheduled orders
      const scheduledFor = ddOrder.scheduling || ddOrder.scheduledFor || ddOrder.scheduled_for || null;

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id,
          customer_name: customerName,
          customer_cpf: customerCpf,
          delivery_type: deliveryType,
          order_type: "delivery",
          delivery_address: deliveryAddress,
          delivery_phone: customerPhone,
          payment_type: paymentType,
          status: orderStatus,
          dd_source: true,
          dd_order_id: ddOrderId,
          delivery_fee: deliveryFee,
          notes: ddOrder.observations || ddOrder.notes || ddOrder.note || null,
          dd_scheduled_for: scheduledFor,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`[dd-polling] Error inserting order ${ddOrderId}:`, orderError);
        continue;
      }

      // Insert items with product matching - try ALL possible field names
      const items = ddOrder.items || ddOrder.orderItems || ddOrder.cart || ddOrder.products || ddOrder.orderProducts || [];
      console.log(`[dd-polling] Order ${ddOrderId} items count: ${items.length}`);
      
      if (!items.length) {
        console.warn(`[dd-polling] Order ${ddOrderId} has NO items! Order keys: ${Object.keys(ddOrder).join(", ")}`);
      }

      if (items.length > 0 && newOrder) {
        const orderItems = [];
        for (const item of items) {
          // DD items can be nested: item.item or flat
          const ddItem = item.item || item;
          const itemName = ddItem.name || ddItem.productName || item.name || "Produto DD";
          const customCode = String(ddItem.customCode || ddItem.custom_code || ddItem.externalCode || ddItem.code || "").trim();
          const quantity = item.amount || item.quantity || 1;

          // Price handling - DD returns cents in Money objects
          let unitPrice = 0;
          if (item.totalPrice !== undefined) {
            unitPrice = money(item.totalPrice) / (quantity || 1);
          } else if (item.unitPrice !== undefined) {
            unitPrice = money(item.unitPrice);
          } else if (ddItem.unitPrice !== undefined) {
            unitPrice = money(ddItem.unitPrice);
          } else if (ddItem.price !== undefined) {
            unitPrice = money(ddItem.price);
          }

          console.log(`[dd-polling] Item: "${itemName}", code: "${customCode}", qty: ${quantity}, unitPrice: ${unitPrice}`);

          // Try to match product by pdv_code first, then by name
          let matchedProductId: string | null = null;
          if (customCode) {
            const match = productsList.find(p => p.pdv_code === customCode);
            if (match) {
              matchedProductId = match.id;
              console.log(`[dd-polling] Matched by pdv_code "${customCode}" -> ${match.id}`);
            }
          }
          if (!matchedProductId && itemName) {
            const match = productsList.find(p => p.name.toLowerCase() === itemName.toLowerCase());
            if (match) {
              matchedProductId = match.id;
              // Use local price if matched and DD price seems off
              if (unitPrice === 0 && match.price) unitPrice = match.price;
              console.log(`[dd-polling] Matched by name "${itemName}" -> ${match.id}`);
            }
          }

          orderItems.push({
            order_id: newOrder.id,
            product_id: matchedProductId,
            quantity,
            price_at_order: unitPrice,
            notes: matchedProductId ? (item.observations || null) : `[DD] ${itemName}${item.observations ? ` - ${item.observations}` : ""}`,
          });
        }

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
