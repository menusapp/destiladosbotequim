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

// Map DD payment to local label using paymentMethod object from DD API
function mapPaymentLabel(paymentMethod: any, isOnlinePayment: boolean): string {
  if (isOnlinePayment) return "Pago Delivery Direto";
  if (!paymentMethod) return "Delivery Direto";
  
  const name = (paymentMethod.name || "").toLowerCase();
  
  // Check for PIX
  if (name.includes("pix")) return "PIX";
  
  // Check for cash/dinheiro
  if (name.includes("dinheiro") || name.includes("cash")) return "Dinheiro";
  
  // Check for credit card
  if (name.includes("crédito") || name.includes("credito") || name.includes("credit")) {
    // Extract brand from name (e.g., "Visa (crédito)" -> "Visa")
    const brand = (paymentMethod.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    return brand ? `Cartão de Crédito ${brand}` : "Cartão de Crédito";
  }
  
  // Check for debit card  
  if (name.includes("débito") || name.includes("debito") || name.includes("debit")) {
    const brand = (paymentMethod.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    return brand ? `Cartão de Débito ${brand}` : "Cartão de Débito";
  }
  
  // Check for meal voucher
  if (name.includes("refeição") || name.includes("refeicao") || name.includes("vale") || name.includes("voucher")) {
    return "Vale Refeição";
  }
  
  // Fallback to the name from DD
  return paymentMethod.name || "Delivery Direto";
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

    const ordersRes = await fetch(ordersUrl, { headers: ddHeaders });

    if (!ordersRes.ok) {
      const errText = await ordersRes.text();
      console.error(`[dd-polling] Orders fetch failed: status=${ordersRes.status}, body=${errText}`);
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

      // NEW ORDER - Fetch full detail from KDS endpoint to get items
      let fullOrder = ddOrder;
      try {
        const kdsDetailUrl = `${DD_API_BASE}/v1/kds/orders/${ddOrder.id}`;
        console.log(`[dd-polling] Fetching order detail: GET ${kdsDetailUrl}`);
        const detailRes = await fetch(kdsDetailUrl, { headers: ddHeaders });
        if (detailRes.ok) {
          const detailText = await detailRes.text();
          const detailData = JSON.parse(detailText);
          if (detailData?.data) {
            fullOrder = detailData.data;
            console.log(`[dd-polling] KDS detail keys: ${Object.keys(fullOrder).join(", ")}`);
            console.log(`[dd-polling] KDS detail (2000): ${JSON.stringify(fullOrder).substring(0, 2000)}`);
          }
        } else {
          console.warn(`[dd-polling] KDS detail failed (${detailRes.status}), using list data`);
        }
      } catch (e) {
        console.warn(`[dd-polling] KDS detail error:`, e);
      }

      // Extract customer fields
      const customer = fullOrder.customer || {};
      const customerName = customer.firstName
        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
        : (customer.name || "Cliente Delivery Direto");
      const customerPhone = customer.telephone || customer.phone || customer.phones?.[0] || "";
      const customerCpf = customer.document || customer.cpf || customer.taxPayerIdentificationNumber || "";

      // Order type mapping
      const ddType = fullOrder.type || fullOrder.delivery_method || fullOrder.deliveryMethod || "";
      const isPickup = ddType === "TAKEOUT" || ddType === "PICKUP";
      const deliveryType = isPickup ? "pickup" : "delivery";

      // Address
      const addr = fullOrder.address || fullOrder.delivery_address || fullOrder.deliveryAddress || null;
      const deliveryAddress = addr
        ? `${addr.street || addr.streetName || ""}, ${addr.number || ""} - ${addr.neighborhood || addr.district || ""}, ${addr.city || ""}`
        : null;

      // Payment mapping using DD's paymentMethod object
      const paymentMethod = fullOrder.paymentMethod || fullOrder.payment || (Array.isArray(fullOrder.payments) ? fullOrder.payments[0] : null) || {};
      const isOnlinePayment = fullOrder.isOnlinePayment === true;
      const paymentLabel = mapPaymentLabel(paymentMethod, isOnlinePayment);
      console.log(`[dd-polling] Order ${ddOrderId} payment: name="${paymentMethod.name}", online=${isOnlinePayment}, mapped="${paymentLabel}"`);

      // Status
      const orderStatus = statusMap[fullOrder.status || "WAITING"] || "pending";

      // Prices - DD returns values in CENTS, ALWAYS divide by 100
      const values = fullOrder.total || fullOrder.values || {};
      const deliveryFee = money(values.deliveryFee || values.delivery_fee);

      // Scheduled orders - DD uses "scheduledOrder" field
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

      // Insert items - from KDS detail: items and compositeItems
      const simpleItems = fullOrder.items || [];
      const compositeItems = fullOrder.compositeItems || [];
      const allItems = [...simpleItems, ...compositeItems];
      console.log(`[dd-polling] Order ${ddOrderId} items: simple=${simpleItems.length}, composite=${compositeItems.length}, total=${allItems.length}`);
      
      if (!allItems.length) {
        console.warn(`[dd-polling] Order ${ddOrderId} has NO items! fullOrder keys: ${Object.keys(fullOrder).join(", ")}`);
      }

      if (allItems.length > 0 && newOrder) {
        const orderItems = [];
        for (const item of allItems) {
          // DD KDS items structure: { item: { name, customCode, ... }, amount, totalPrice, unitPrice, ... }
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
              if (unitPrice === 0 && match.price) unitPrice = match.price;
              console.log(`[dd-polling] Matched by name "${itemName}" -> ${match.id}`);
            }
          }

          // Build observations from item options/subitems for composite items
          let itemNotes = item.observations || "";
          if (item.subitems && Array.isArray(item.subitems)) {
            const subNames = item.subitems.map((s: any) => s.item?.name || s.name || "").filter(Boolean);
            if (subNames.length) itemNotes += (itemNotes ? " | " : "") + subNames.join(", ");
          }
          if (item.options && Array.isArray(item.options)) {
            const optNames = item.options.map((o: any) => o.name || o.option?.name || "").filter(Boolean);
            if (optNames.length) itemNotes += (itemNotes ? " | " : "") + optNames.join(", ");
          }

          orderItems.push({
            order_id: newOrder.id,
            product_id: matchedProductId,
            quantity,
            price_at_order: unitPrice,
            notes: matchedProductId ? (itemNotes || null) : `[DD] ${itemName}${itemNotes ? ` - ${itemNotes}` : ""}`,
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
