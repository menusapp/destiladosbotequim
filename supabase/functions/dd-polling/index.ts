import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DD_ADMIN_API = "https://deliverydireto.com.br/admin-api/v1";

// Convert DD Money object (cents) to decimal - ALL DD values are in cents
function money(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && v.value !== undefined) return v.value / 100;
  if (typeof v === "number") return v / 100;
  return 0;
}

// Map DD payment to local label using store-api payment object
function mapPaymentLabel(payment: any): string {
  if (!payment) return "Delivery Direto";
  
  const payType = (payment.type || "").toUpperCase();
  const details = payment.paymentDetails || {};
  const detailType = (details.type || "").toUpperCase();
  const brand = details.brand || details.cardBrand || "";
  
  // Online payment (PIX online, card online) = pre-paid through DD
  if (payType === "ONLINE") return "Pago Delivery Direto";
  
  // Offline payment - paid at delivery/pickup
  if (payType === "OFFLINE" || payType === "AT_DELIVERY") {
    if (detailType === "CASH" || detailType === "DINHEIRO") return "Dinheiro";
    if (detailType === "PIX") return "PIX";
    if (detailType === "CREDITCARD" || detailType === "CREDIT_CARD") {
      return brand ? `Cartão de Crédito ${brand}` : "Cartão de Crédito";
    }
    if (detailType === "DEBITCARD" || detailType === "DEBIT_CARD") {
      return brand ? `Cartão de Débito ${brand}` : "Cartão de Débito";
    }
    if (detailType === "MEAL_VOUCHER" || detailType === "FOOD_VOUCHER") return "Vale Refeição";
    
    // Fallback: try to parse from name field
    const name = (details.name || payment.name || "").toLowerCase();
    if (name.includes("pix")) return "PIX";
    if (name.includes("dinheiro") || name.includes("cash")) return "Dinheiro";
    if (name.includes("crédito") || name.includes("credito") || name.includes("credit")) {
      const extractedBrand = (details.name || payment.name || "").replace(/\s*\(.*\)\s*/, "").trim();
      return extractedBrand ? `Cartão de Crédito ${extractedBrand}` : "Cartão de Crédito";
    }
    if (name.includes("débito") || name.includes("debito") || name.includes("debit")) {
      const extractedBrand = (details.name || payment.name || "").replace(/\s*\(.*\)\s*/, "").trim();
      return extractedBrand ? `Cartão de Débito ${extractedBrand}` : "Cartão de Débito";
    }
    if (name.includes("vale") || name.includes("voucher") || name.includes("refeição")) return "Vale Refeição";
    
    return details.name || payment.name || "Delivery Direto";
  }

  // Also check legacy paymentMethod field
  const legacyName = (payment.name || "").toLowerCase();
  if (legacyName.includes("pix")) return "PIX";
  if (legacyName.includes("dinheiro")) return "Dinheiro";
  if (legacyName.includes("crédito") || legacyName.includes("credito")) {
    const b = (payment.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    return b ? `Cartão de Crédito ${b}` : "Cartão de Crédito";
  }
  if (legacyName.includes("débito") || legacyName.includes("debito")) {
    const b = (payment.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    return b ? `Cartão de Débito ${b}` : "Cartão de Débito";
  }

  return payment.name || "Delivery Direto";
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

    const ddHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
      "X-DeliveryDireto-Id": config.store_id,
      "Accept": "application/json",
    };

    // Build query - use store-api orders endpoint
    const now = new Date();
    const lastSync = config.last_sync_at
      ? new Date(config.last_sync_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const params = new URLSearchParams();
    params.set("updatedAt[gte]", lastSync.toISOString());
    params.set("limit", "50");

    const ordersUrl = `${DD_ADMIN_API}/orders?${params.toString()}`;
    console.log(`[dd-polling] Fetching orders: ${ordersUrl}`);

    const ordersRes = await fetch(ordersUrl, { headers: ddHeaders });

    if (!ordersRes.ok) {
      const errText = await ordersRes.text();
      console.error(`[dd-polling] Orders fetch failed: status=${ordersRes.status}, body=${errText.substring(0, 500)}`);
      return new Response(JSON.stringify({ new_orders: 0, error: "Falha ao buscar pedidos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ordersText = await ordersRes.text();

    let ordersData: any;
    try {
      ordersData = JSON.parse(ordersText);
    } catch {
      console.error("[dd-polling] Failed to parse response as JSON");
      return new Response(JSON.stringify({ new_orders: 0, error: "Invalid JSON from DD API" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle various response shapes
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
    console.log(`[dd-polling] Found ${ordersList.length} orders from admin-api`);
    
    // Log first order structure for debugging
    if (ordersList.length > 0) {
      const first = ordersList[0];
      console.log(`[dd-polling] First order keys: ${Object.keys(first).join(", ")}`);
      console.log(`[dd-polling] First order (3000): ${JSON.stringify(first).substring(0, 3000)}`);
    }

    const statusMap: Record<string, string> = {
      "WAITING": "pending",
      "PLACED": "pending",
      "APPROVED": "accepted",
      "CONFIRMED": "accepted",
      "PREPARING": "preparing",
      "READY": "ready",
      "DISPATCHED": "out_for_delivery",
      "DONE": "delivered",
      "DELIVERED": "delivered",
      "CANCELLED": "cancelled",
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

      // NEW ORDER - Fetch full detail from KDS endpoint to get items
      let fullOrder = ddOrder;
      const orderId = ddOrder.id || ddOrder.orderNumber;
      try {
        // Use KDS detail endpoint which returns complete items
        // Correct KDS endpoint: singular "order" with query param
        const detailUrl = `${DD_ADMIN_API}/kds/order?orderId=${orderId}`;
        console.log(`[dd-polling] Fetching order detail: GET ${detailUrl}`);
        const detailRes = await fetch(detailUrl, { headers: ddHeaders });
        if (detailRes.ok) {
          const detailText = await detailRes.text();
          const detailData = JSON.parse(detailText);
          fullOrder = detailData?.data || detailData;
          console.log(`[dd-polling] KDS Detail keys: ${Object.keys(fullOrder).join(", ")}`);
          console.log(`[dd-polling] KDS Detail (3000): ${JSON.stringify(fullOrder).substring(0, 3000)}`);
        } else {
          const errBody = await detailRes.text();
          console.warn(`[dd-polling] KDS detail failed for ${orderId}: status=${detailRes.status}, body=${errBody.substring(0, 500)}`);
        }
      } catch (e) {
        console.warn(`[dd-polling] Detail error:`, e);
      }

      // If items still empty, try fetching items separately
      let orderItems = fullOrder.items || fullOrder.orderItems || fullOrder.cart || [];
      if (!orderItems.length && orderId) {
        try {
          const itemsUrl = `${DD_ADMIN_API}/orders/${orderId}/items`;
          console.log(`[dd-polling] Fetching items separately: GET ${itemsUrl}`);
          const itemsRes = await fetch(itemsUrl, { headers: ddHeaders });
          if (itemsRes.ok) {
            const itemsText = await itemsRes.text();
            const itemsData = JSON.parse(itemsText);
            orderItems = itemsData?.data || itemsData || [];
            if (Array.isArray(orderItems)) {
              console.log(`[dd-polling] Got ${orderItems.length} items from items endpoint`);
            }
          } else {
            const errBody = await itemsRes.text();
            console.warn(`[dd-polling] Items endpoint failed (${itemsRes.status}): ${errBody.substring(0, 200)}`);
          }
        } catch (e) {
          console.warn(`[dd-polling] Items fetch error:`, e);
        }
      }

      // Extract customer fields
      const customer = fullOrder.customer || {};
      const customerName = customer.firstName
        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
        : (customer.name || "Cliente Delivery Direto");
      const customerPhone = customer.telephone || customer.phone || customer.phones?.[0] || "";
      const customerCpf = customer.document || customer.cpf || customer.taxPayerIdentificationNumber || "";

      // Order type mapping
      const ddType = (fullOrder.type || fullOrder.delivery_method || fullOrder.deliveryMethod || "").toUpperCase();
      const isPickup = ddType === "TAKEOUT" || ddType === "PICKUP";
      const deliveryType = isPickup ? "pickup" : "delivery";

      // Address
      const addr = fullOrder.address || fullOrder.delivery_address || fullOrder.deliveryAddress || null;
      const deliveryAddress = addr
        ? `${addr.street || addr.streetName || ""}, ${addr.number || ""} - ${addr.neighborhood || addr.district || ""}, ${addr.city || ""}`
        : null;

      // Payment mapping - store-api provides payment.type and payment.paymentDetails
      const payment = fullOrder.payment || (Array.isArray(fullOrder.payments) ? fullOrder.payments[0] : null) || fullOrder.paymentMethod || {};
      const paymentLabel = mapPaymentLabel(payment);
      console.log(`[dd-polling] Order ${ddOrderId} payment: ${JSON.stringify(payment).substring(0, 300)}, mapped="${paymentLabel}"`);

      // Status
      const orderStatus = statusMap[fullOrder.status || "WAITING"] || "pending";

      // Prices - DD returns values in CENTS
      const values = fullOrder.total || fullOrder.values || {};
      const deliveryFee = money(values.deliveryFee || values.delivery_fee);

      // Scheduled orders
      const scheduledFor = fullOrder.scheduledOrder || fullOrder.scheduling || fullOrder.scheduledFor || null;

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
          payment_type: paymentLabel,
          status: orderStatus,
          dd_source: true,
          dd_order_id: ddOrderId,
          delivery_fee: deliveryFee,
          notes: fullOrder.observations || fullOrder.notes || fullOrder.note || null,
          dd_scheduled_for: scheduledFor,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`[dd-polling] Error inserting order ${ddOrderId}:`, orderError);
        continue;
      }

      // Process items
      const allDDItems = Array.isArray(orderItems) ? orderItems : [];
      // Also check for compositeItems
      const compositeItems = fullOrder.compositeItems || [];
      const combinedItems = [...allDDItems, ...compositeItems];
      
      console.log(`[dd-polling] Order ${ddOrderId} items: direct=${allDDItems.length}, composite=${compositeItems.length}, total=${combinedItems.length}`);

      if (!combinedItems.length) {
        console.warn(`[dd-polling] Order ${ddOrderId} has NO items! Order keys: ${Object.keys(fullOrder).join(", ")}`);
      }

      if (combinedItems.length > 0 && newOrder) {
        const insertItems = [];
        for (const item of combinedItems) {
          // store-api items: { itemId, amount, totalPrice: {value,currency}, item: {name, customCode, price: {value,currency}} }
          const ddItem = item.item || item;
          const itemName = ddItem.name || ddItem.productName || item.name || "Produto DD";
          const customCode = String(ddItem.customCode || ddItem.custom_code || ddItem.externalCode || ddItem.code || ddItem.pdvCode || "").trim();
          const quantity = item.amount || item.quantity || 1;

          // Price handling
          let unitPrice = 0;
          if (item.totalPrice !== undefined) {
            unitPrice = money(item.totalPrice) / (quantity || 1);
          } else if (item.unitPrice !== undefined) {
            unitPrice = money(item.unitPrice);
          } else if (ddItem.price !== undefined) {
            unitPrice = money(ddItem.price);
          }

          console.log(`[dd-polling] Item: "${itemName}", code: "${customCode}", qty: ${quantity}, unitPrice: R$${unitPrice.toFixed(2)}`);

          // Match product by pdv_code first, then by name
          let matchedProductId: string | null = null;
          if (customCode) {
            const match = productsList.find(p => p.pdv_code === customCode);
            if (match) {
              matchedProductId = match.id;
              if (unitPrice === 0 && match.price) unitPrice = match.price;
              console.log(`[dd-polling] Matched by pdv_code "${customCode}" -> ${match.id}`);
            }
          }
          if (!matchedProductId && itemName) {
            const match = productsList.find(p => p.name.toLowerCase() === itemName.toLowerCase());
            if (match) {
              matchedProductId = match.id;
              if (unitPrice === 0 && match.price) unitPrice = match.price;
              console.log(`[dd-polling] Matched by name "${itemName}" -> ${match.id}`);
            }
          }

          // Build observations from subitems/options
          let itemNotes = item.observations || "";
          if (item.subitems && Array.isArray(item.subitems)) {
            const subNames = item.subitems.map((s: any) => s.item?.name || s.name || "").filter(Boolean);
            if (subNames.length) itemNotes += (itemNotes ? " | " : "") + subNames.join(", ");
          }
          if (item.options && Array.isArray(item.options)) {
            const optNames = item.options.map((o: any) => o.name || o.option?.name || "").filter(Boolean);
            if (optNames.length) itemNotes += (itemNotes ? " | " : "") + optNames.join(", ");
          }

          insertItems.push({
            order_id: newOrder.id,
            product_id: matchedProductId,
            quantity,
            price_at_order: unitPrice,
            notes: matchedProductId ? (itemNotes || null) : `[DD] ${itemName}${itemNotes ? ` - ${itemNotes}` : ""}`,
          });
        }

        const { error: itemsError } = await supabase.from("order_items").insert(insertItems);
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
