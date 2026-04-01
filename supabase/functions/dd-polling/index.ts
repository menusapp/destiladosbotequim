import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DD_ADMIN_API = "https://deliverydireto.com.br/admin-api/v1";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert DD Money object (cents) to decimal */
function money(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && v.value !== undefined) return v.value / 100;
  if (typeof v === "number") return v / 100;
  return 0;
}

/** Normalize a string for comparison: trim, uppercase, collapse spaces */
function normalize(s: string | null | undefined): string {
  return (s || "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Map DD paymentMethod object to a human-readable label */
function mapPaymentLabel(pm: any, isOnlinePayment: boolean): string {
  if (isOnlinePayment) return "Pago Delivery Direto";
  if (!pm) return "Delivery Direto";

  const name = (pm.name || "").toLowerCase();

  if (name.includes("pix")) return "PIX";
  if (name.includes("dinheiro") || name.includes("cash")) return "Dinheiro";

  if (name.includes("crédito") || name.includes("credito")) {
    // Extract brand from name like "Visa (crédito)" → "Visa"
    const brand = (pm.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    return brand ? `Cartão de Crédito ${brand}` : "Cartão de Crédito";
  }

  if (name.includes("débito") || name.includes("debito")) {
    const brand = (pm.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    return brand ? `Cartão de Débito ${brand}` : "Cartão de Débito";
  }

  if (name.includes("vale") || name.includes("voucher") || name.includes("refeição")) {
    return "Vale Refeição";
  }

  return pm.name || "Delivery Direto";
}

// ─── DD Status → Local Status ───────────────────────────────────────────────

const statusMap: Record<string, string> = {
  WAITING: "pending",
  PLACED: "pending",
  APPROVED: "accepted",
  CONFIRMED: "accepted",
  PREPARING: "preparing",
  IN_TRANSIT: "out_for_delivery",
  DISPATCHED: "out_for_delivery",
  READY: "ready",
  DONE: "delivered",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REJECTED: "cancelled",
};

// ─── Main Handler ───────────────────────────────────────────────────────────

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

    // ── Get config ──────────────────────────────────────────────────────────
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

    // ── Check / refresh token ───────────────────────────────────────────────
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

    // ── DD request headers (required by Admin API) ──────────────────────────
    const ddHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
      "X-DeliveryDireto-Id": config.store_id,
      Accept: "application/json",
    };

    // ── Build query ─────────────────────────────────────────────────────────
    // Official Admin API: GET /admin-api/v1/orders
    // CRITICAL: showItems, showExtras, showMetadata default to FALSE
    const now = new Date();
    const lastSync = config.last_sync_at
      ? new Date(config.last_sync_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const params = new URLSearchParams();
    // Filters — use lastModifiedStart/End per official doc
    params.set("lastModifiedStart", lastSync.toISOString());
    params.set("limit", "50");
    // REQUIRED: ask the API to include item details
    params.set("showItems", "true");
    params.set("showExtras", "true");
    params.set("showMetadata", "true");

    const ordersUrl = `${DD_ADMIN_API}/orders?${params.toString()}`;
    console.log(`[dd-polling] Fetching orders: ${ordersUrl}`);

    const ordersRes = await fetch(ordersUrl, { headers: ddHeaders });

    if (!ordersRes.ok) {
      const errText = await ordersRes.text();
      console.error(`[dd-polling] Orders fetch failed: method=GET, url=${ordersUrl}, status=${ordersRes.status}, body=${errText.substring(0, 500)}`);
      return new Response(JSON.stringify({ new_orders: 0, error: "Falha ao buscar pedidos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ordersText = await ordersRes.text();
    let ordersData: any;
    try {
      ordersData = JSON.parse(ordersText);
    } catch {
      console.error("[dd-polling] Failed to parse JSON response");
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

    // Log first order for debugging
    if (ordersList.length > 0) {
      const first = ordersList[0];
      console.log(`[dd-polling] First order keys: ${Object.keys(first).join(", ")}`);
      console.log(`[dd-polling] First order items count: ${(first.items || []).length}, compositeItems: ${(first.compositeItems || []).length}`);
      console.log(`[dd-polling] First order (3000): ${JSON.stringify(first).substring(0, 3000)}`);
    }

    // ── Pre-fetch products for matching ─────────────────────────────────────
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, pdv_code, price")
      .eq("restaurant_id", restaurant_id);
    const productsList = allProducts || [];

    // Also fetch product extras for option/property matching
    const { data: allExtras } = await supabase
      .from("product_extras")
      .select("id, name, pdv_code, price, product_id")
      .in("product_id", productsList.map(p => p.id));
    const extrasList = allExtras || [];

    let newOrdersCount = 0;

    for (const ddOrder of ordersList) {
      const ddOrderId = String(ddOrder.orderNumber || ddOrder.id || "");
      if (!ddOrderId) continue;

      // ── Check if already imported ───────────────────────────────────────
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("dd_order_id", ddOrderId)
        .eq("restaurant_id", restaurant_id)
        .maybeSingle();

      if (existing) {
        // Just sync status if changed
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

      // ── NEW ORDER ─────────────────────────────────────────────────────────

      // Items from the listing (should be populated with showItems=true)
      const rawItems = ddOrder.items || [];
      const compositeItems = ddOrder.compositeItems || [];

      console.log(`[dd-polling] Order ${ddOrderId}: items=${rawItems.length}, compositeItems=${compositeItems.length}`);

      // If listing still returned empty items, try GET /orders/{id} as fallback
      let fullOrder = ddOrder;
      if (rawItems.length === 0 && compositeItems.length === 0) {
        const orderId = ddOrder.id || ddOrder.orderNumber;
        try {
          const detailUrl = `${DD_ADMIN_API}/orders/${orderId}?showItems=true&showExtras=true&showMetadata=true`;
          console.log(`[dd-polling] Items empty in listing, fetching detail: GET ${detailUrl}`);
          const detailRes = await fetch(detailUrl, { headers: ddHeaders });
          if (detailRes.ok) {
            const detailText = await detailRes.text();
            const detailData = JSON.parse(detailText);
            fullOrder = detailData?.data || detailData;
            console.log(`[dd-polling] Detail response keys: ${Object.keys(fullOrder).join(", ")}`);
            console.log(`[dd-polling] Detail items: ${(fullOrder.items || []).length}, compositeItems: ${(fullOrder.compositeItems || []).length}`);
            console.log(`[dd-polling] Detail (3000): ${JSON.stringify(fullOrder).substring(0, 3000)}`);
          } else {
            const errBody = await detailRes.text();
            console.warn(`[dd-polling] Detail fetch failed: status=${detailRes.status}, body=${errBody.substring(0, 500)}`);
          }
        } catch (e) {
          console.warn(`[dd-polling] Detail error:`, e);
        }
      }

      // ── Extract customer ────────────────────────────────────────────────
      const customer = fullOrder.customer || {};
      const customerName = customer.firstName
        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
        : (customer.name || "Cliente Delivery Direto");
      const customerPhone = customer.telephone || customer.phone || "";
      const customerCpf = customer.document || customer.cpf || "";

      // ── Order type ──────────────────────────────────────────────────────
      const ddType = (fullOrder.type || "").toUpperCase();
      const isPickup = ddType === "TAKEOUT" || ddType === "PICKUP";
      const deliveryType = isPickup ? "pickup" : "delivery";

      // ── Address ─────────────────────────────────────────────────────────
      const addr = fullOrder.address || null;
      const deliveryAddress = addr
        ? `${addr.street || ""}, ${addr.number || ""} - ${addr.neighborhood || ""}, ${addr.city || ""}`
        : null;

      // ── Payment ─────────────────────────────────────────────────────────
      // Admin API uses "paymentMethod" object with "name" field
      const paymentMethod = fullOrder.paymentMethod || {};
      const isOnlinePayment = fullOrder.isOnlinePayment === true;
      const paymentLabel = mapPaymentLabel(paymentMethod, isOnlinePayment);
      console.log(`[dd-polling] Order ${ddOrderId} payment: name="${paymentMethod.name}", isOnline=${isOnlinePayment}, mapped="${paymentLabel}"`);

      // ── Status ──────────────────────────────────────────────────────────
      const orderStatus = statusMap[fullOrder.status || "WAITING"] || "pending";

      // ── Prices (cents → decimal) ────────────────────────────────────────
      const values = fullOrder.total || {};
      const deliveryFee = money(values.deliveryFee);

      // ── Scheduled ───────────────────────────────────────────────────────
      const scheduledFor = fullOrder.scheduledOrder || null;

      // ── Insert order ────────────────────────────────────────────────────
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
          notes: fullOrder.notes || null,
          dd_scheduled_for: scheduledFor,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`[dd-polling] Error inserting order ${ddOrderId}:`, orderError);
        continue;
      }

      // ── Process items ───────────────────────────────────────────────────
      const allDDItems = fullOrder.items || [];
      const allCompositeItems = fullOrder.compositeItems || [];

      console.log(`[dd-polling] Order ${ddOrderId} processing: items=${allDDItems.length}, compositeItems=${allCompositeItems.length}`);

      if (!allDDItems.length && !allCompositeItems.length) {
        console.warn(`[dd-polling] ⚠ Order ${ddOrderId} has NO items and NO compositeItems!`);
        console.warn(`[dd-polling] Order keys: ${Object.keys(fullOrder).join(", ")}`);
      }

      // Log available products for matching debug
      console.log(`[dd-polling] Available products for matching: ${productsList.length}`);
      if (productsList.length > 0) {
        console.log(`[dd-polling] Products with pdv_code: ${productsList.filter(p => p.pdv_code).map(p => `"${p.name}"→pdv="${p.pdv_code}"`).join(", ")}`);
      }

      const insertItems: any[] = [];
      const insertExtras: any[] = [];

      // ── Process regular items ───────────────────────────────────────────
      for (const item of allDDItems) {
        // DD API returns items flat (customCode, name directly on item)
        // But some versions nest under item.item - check both
        const ddItem = item.item || item;
        const itemName = ddItem.name || item.name || "Produto DD";
        
        // Extract customCode from ALL possible paths
        const rawCustomCode = ddItem.customCode ?? ddItem.custom_code ?? ddItem.externalCode ?? ddItem.code ?? ddItem.pdvCode ?? item.customCode ?? item.custom_code ?? item.externalCode ?? "";
        const customCode = normalize(String(rawCustomCode));
        const quantity = item.amount || item.quantity || ddItem.amount || ddItem.quantity || 1;

        // Price
        let unitPrice = 0;
        if (item.totalPrice !== undefined) {
          unitPrice = money(item.totalPrice) / (quantity || 1);
        } else if (item.unitPrice !== undefined) {
          unitPrice = money(item.unitPrice);
        } else if (item.price !== undefined) {
          unitPrice = money(item.price);
        } else if (ddItem.price !== undefined) {
          unitPrice = money(ddItem.price);
        }

        console.log(`[dd-polling] ── ITEM DEBUG ──`);
        console.log(`[dd-polling]   raw item keys: ${Object.keys(item).join(", ")}`);
        if (item.item) console.log(`[dd-polling]   item.item keys: ${Object.keys(item.item).join(", ")}`);
        console.log(`[dd-polling]   name="${itemName}", rawCustomCode="${rawCustomCode}", normalizedCode="${customCode}"`);
        console.log(`[dd-polling]   qty=${quantity}, unitPrice=R$${unitPrice.toFixed(2)}`);

        // Match product by customCode → pdv_code (normalized)
        let matchedProductId: string | null = null;
        let matchRule = "none";

        if (customCode && customCode !== "") {
          const match = productsList.find(p => p.pdv_code && normalize(p.pdv_code) === customCode);
          if (match) {
            matchedProductId = match.id;
            matchRule = `customCode "${customCode}" → pdv_code "${match.pdv_code}"`;
            if (unitPrice === 0 && match.price) unitPrice = match.price;
            console.log(`[dd-polling]   ✓ MATCHED by ${matchRule} → product "${match.name}" (${match.id})`);
          } else {
            console.log(`[dd-polling]   ✗ No product with pdv_code="${customCode}". Available pdv_codes: [${productsList.filter(p=>p.pdv_code).map(p=>normalize(p.pdv_code)).join(", ")}]`);
          }
        } else {
          console.log(`[dd-polling]   ℹ No customCode found on this item`);
        }

        // Fallback: match by normalized name
        if (!matchedProductId && itemName) {
          const normalizedName = normalize(itemName);
          // Try exact match first
          let match = productsList.find(p => normalize(p.name) === normalizedName);
          // Try contains match as second fallback
          if (!match) {
            match = productsList.find(p => normalize(p.name).includes(normalizedName) || normalizedName.includes(normalize(p.name)));
          }
          if (match) {
            matchedProductId = match.id;
            matchRule = `name "${itemName}" → "${match.name}"`;
            if (unitPrice === 0 && match.price) unitPrice = match.price;
            console.log(`[dd-polling]   ✓ MATCHED by ${matchRule} (${match.id})`);
          } else {
            console.log(`[dd-polling]   ✗ No product matching name "${itemName}". Searched ${productsList.length} products.`);
            matchRule = "FALLBACK (no match)";
          }
        }

        // Build notes from properties/options/subitems
        let itemNotes = item.observations || item.comments || "";

        // Properties (variações) - also try to match as extras
        if (item.properties && Array.isArray(item.properties)) {
          for (const prop of item.properties) {
            const propName = prop.name || prop.propertyName || "";
            const options = prop.options || prop.selectedOptions || [];
            if (Array.isArray(options) && options.length > 0) {
              const optNames = options.map((o: any) => o.name || o.optionName || "").filter(Boolean);
              if (optNames.length) {
                itemNotes += (itemNotes ? " | " : "") + `${propName}: ${optNames.join(", ")}`;
              }
              // Try matching options as product extras
              if (matchedProductId) {
                for (const opt of options) {
                  const optName = opt.name || opt.optionName || "";
                  const optCode = normalize(opt.customCode || opt.externalCode || "");
                  const optPrice = money(opt.price || opt.totalPrice || 0);
                  
                  let matchedExtra = null;
                  if (optCode) {
                    matchedExtra = extrasList.find(e => e.product_id === matchedProductId && e.pdv_code && normalize(e.pdv_code) === optCode);
                  }
                  if (!matchedExtra && optName) {
                    matchedExtra = extrasList.find(e => e.product_id === matchedProductId && normalize(e.name) === normalize(optName));
                  }
                  if (matchedExtra) {
                    console.log(`[dd-polling]   ✓ Extra matched: "${optName}" → "${matchedExtra.name}" (${matchedExtra.id})`);
                  }
                }
              }
            }
            console.log(`[dd-polling]   Property: "${propName}", options: ${JSON.stringify(options).substring(0, 200)}`);
          }
        }

        // Options (opções diretas)
        if (item.options && Array.isArray(item.options)) {
          const optNames = item.options.map((o: any) => o.name || o.optionName || "").filter(Boolean);
          if (optNames.length) {
            itemNotes += (itemNotes ? " | " : "") + `Opções: ${optNames.join(", ")}`;
          }
        }

        // Subitems (extras/adicionais)
        if (item.subitems && Array.isArray(item.subitems)) {
          const subNames = item.subitems.map((s: any) => s.item?.name || s.name || "").filter(Boolean);
          if (subNames.length) {
            itemNotes += (itemNotes ? " | " : "") + `Extras: ${subNames.join(", ")}`;
          }
        }

        console.log(`[dd-polling]   RESULT: product_id=${matchedProductId || "NULL"}, matchRule=${matchRule}`);

        insertItems.push({
          order_id: newOrder.id,
          product_id: matchedProductId,
          quantity,
          price_at_order: unitPrice,
          notes: matchedProductId ? (itemNotes || null) : `[DD] ${itemName}${itemNotes ? ` - ${itemNotes}` : ""}`,
        });
      }

      // ── Process composite items (pizzas, combos) ────────────────────────
      for (const composite of allCompositeItems) {
        const compositeName = composite.name || composite.compositeName || "Combo DD";
        const quantity = composite.amount || composite.quantity || 1;
        let totalPrice = 0;

        if (composite.totalPrice !== undefined) {
          totalPrice = money(composite.totalPrice);
        } else if (composite.price !== undefined) {
          totalPrice = money(composite.price);
        }

        const unitPrice = totalPrice / (quantity || 1);

        console.log(`[dd-polling] CompositeItem: "${compositeName}", qty=${quantity}, total=R$${totalPrice.toFixed(2)}`);

        // Build description from sub-items of the composite
        let compositeNotes = "";
        const subItems = composite.items || composite.subItems || [];
        if (Array.isArray(subItems)) {
          const subDescs = subItems.map((si: any) => {
            const siItem = si.item || si;
            return siItem.name || si.name || "";
          }).filter(Boolean);
          if (subDescs.length) {
            compositeNotes = subDescs.join(", ");
          }
        }

        // Try matching the composite by customCode or name
        const customCode = normalize(composite.customCode || composite.custom_code || "");
        let matchedProductId: string | null = null;

        if (customCode) {
          const match = productsList.find(p => p.pdv_code && normalize(p.pdv_code) === customCode);
          if (match) {
            matchedProductId = match.id;
            console.log(`[dd-polling] ✓ Composite matched by customCode "${customCode}" → "${match.name}"`);
          }
        }
        if (!matchedProductId) {
          const normalizedName = normalize(compositeName);
          let match = productsList.find(p => normalize(p.name) === normalizedName);
          if (!match) {
            match = productsList.find(p => normalize(p.name).includes(normalizedName) || normalizedName.includes(normalize(p.name)));
          }
          if (match) {
            matchedProductId = match.id;
            console.log(`[dd-polling] ✓ Composite matched by name "${compositeName}" → "${match.name}"`);
          }
        }

        insertItems.push({
          order_id: newOrder.id,
          product_id: matchedProductId,
          quantity,
          price_at_order: unitPrice,
          notes: matchedProductId
            ? (compositeNotes || null)
            : `[DD Combo] ${compositeName}${compositeNotes ? ` (${compositeNotes})` : ""}`,
        });
      }

      // ── Insert all items ────────────────────────────────────────────────
      if (insertItems.length > 0) {
        console.log(`[dd-polling] Inserting ${insertItems.length} items for order ${ddOrderId}:`);
        for (const it of insertItems) {
          console.log(`[dd-polling]   → product_id=${it.product_id || "NULL"}, qty=${it.quantity}, price=${it.price_at_order}, notes="${(it.notes || "").substring(0, 100)}"`);
        }
        const { error: itemsError } = await supabase.from("order_items").insert(insertItems);
        if (itemsError) {
          console.error(`[dd-polling] Error inserting items for order ${ddOrderId}:`, itemsError);
        } else {
          console.log(`[dd-polling] ✓ ${insertItems.length} items inserted successfully`);
        }
      }

      newOrdersCount++;
      console.log(`[dd-polling] ✓ New order imported: DD#${ddOrderId} → ${newOrder.id} (${insertItems.length} items)`);
    }

    // ── Update last_sync_at ─────────────────────────────────────────────────
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
