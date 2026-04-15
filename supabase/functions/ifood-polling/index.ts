import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IFOOD_API = "https://merchant-api.ifood.com.br";

/** Normalize a string for comparison: trim, uppercase, collapse spaces */
function normalize(s: string | null | undefined): string {
  return (s || "").trim().toUpperCase().replace(/\s+/g, " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurant_id } = await req.json();

    // Get config
    const { data: config } = await supabase
      .from("ifood_config")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .single();

    if (!config || !config.enabled || !config.access_token) {
      return new Response(
        JSON.stringify({ error: "iFood not configured or disabled", new_orders: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve merchant_id: from DB or extract from JWT
    let merchantId = config.merchant_id;
    if (!merchantId && config.access_token) {
      try {
        const jwtParts = config.access_token.split(".");
        if (jwtParts.length >= 2) {
          const payload = JSON.parse(atob(jwtParts[1]));
          const merchantScope = payload.merchant_scope;
          if (Array.isArray(merchantScope) && merchantScope.length > 0) {
            merchantId = merchantScope[0].split(":")[0];
          }
          if (!merchantId) {
            merchantId = payload.merchant_id || payload.merchantId || null;
          }
          if (merchantId) {
            await supabase
              .from("ifood_config")
              .update({ merchant_id: merchantId })
              .eq("restaurant_id", restaurant_id);
          }
        }
      } catch (_) { /* JWT decode failed */ }
    }

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: "No merchant_id available", new_orders: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiry (30 min buffer) — auto-refresh if needed
    let accessToken = config.access_token;
    const expiresAt = new Date(config.token_expires_at).getTime();
    const now = Date.now();
    if (expiresAt - now < 30 * 60 * 1000) {
      console.log("[ifood-polling] Token expiring soon, auto-refreshing...");
      const clientId = Deno.env.get("IFOOD_CLIENT_ID");
      const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET");
      if (!clientId || !clientSecret || !config.refresh_token) {
        return new Response(
          JSON.stringify({ error: "Cannot refresh token — missing credentials or refresh_token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      try {
        const refreshRes = await fetch(`${IFOOD_API}/authentication/v1.0/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grantType: "refresh_token",
            clientId,
            clientSecret,
            refreshToken: config.refresh_token,
          }),
        });
        if (!refreshRes.ok) {
          const errText = await refreshRes.text();
          console.error("[ifood-polling] Refresh failed:", errText);
          return new Response(
            JSON.stringify({ error: "Token refresh failed. Reconnect iFood.", details: errText }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const tokenData = await refreshRes.json();
        if (!tokenData.accessToken) {
          return new Response(
            JSON.stringify({ error: "Invalid token response from iFood" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = tokenData.accessToken;
        const newExpiresAt = new Date(Date.now() + tokenData.expiresIn * 1000).toISOString();
        await supabase.from("ifood_config").update({
          access_token: tokenData.accessToken,
          refresh_token: tokenData.refreshToken,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        }).eq("restaurant_id", restaurant_id);
        console.log("[ifood-polling] Token refreshed successfully, expires:", newExpiresAt);
      } catch (e) {
        console.error("[ifood-polling] Refresh error:", e);
        return new Response(
          JSON.stringify({ error: "Token refresh exception", details: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Poll events
    const eventsRes = await fetch(`${IFOOD_API}/events/v1.0/events:polling`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Polling-Merchants": merchantId,
      },
    });

    if (!eventsRes.ok) {
      if (eventsRes.status === 401 || eventsRes.status === 403) {
        return new Response(
          JSON.stringify({ error: "Token invalid" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Polling failed", status: eventsRes.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventsText = await eventsRes.text();
    const events = eventsText ? JSON.parse(eventsText) : [];

    if (!Array.isArray(events) || events.length === 0) {
      await supabase
        .from("ifood_config")
        .update({ last_polling_at: new Date().toISOString() })
        .eq("restaurant_id", restaurant_id);

      return new Response(
        JSON.stringify({ success: true, new_orders: 0, events_processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Pre-fetch products & extras for matching ────────────────────────────
    const { data: restaurantCategories } = await supabase
      .from("categories")
      .select("id")
      .eq("restaurant_id", restaurant_id);
    const categoryIds = (restaurantCategories || []).map((c: any) => c.id);

    let productsList: any[] = [];
    let extraCategoryItemsList: any[] = [];

    if (categoryIds.length > 0) {
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, pdv_code, price")
        .in("category_id", categoryIds);
      productsList = allProducts || [];
    }

    // Fetch extra_category_items (complementos do sistema) for this restaurant
    const { data: allExtraCategories } = await supabase
      .from("extra_categories")
      .select("id")
      .eq("restaurant_id", restaurant_id);
    const extraCatIds = (allExtraCategories || []).map((c: any) => c.id);

    if (extraCatIds.length > 0) {
      const { data: allExtraItems } = await supabase
        .from("extra_category_items")
        .select("id, name, pdv_code, price, category_id")
        .in("category_id", extraCatIds);
      extraCategoryItemsList = allExtraItems || [];
    }

    console.log(`[ifood-polling] Loaded ${productsList.length} products, ${extraCategoryItemsList.length} extra_category_items for matching`);

    let newOrdersCount = 0;
    const eventIds: { id: string }[] = [];

    for (const event of events) {
      eventIds.push({ id: event.id });
      const eventCode = event.fullCode || event.code || "";
      const orderId = event.orderId;
      console.log("Evento recebido:", JSON.stringify({ id: event.id, code: event.code, fullCode: event.fullCode, orderId: event.orderId }));

      if (eventCode === "PLACED") {
        // Check if order already exists
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("ifood_order_id", orderId)
          .maybeSingle();

        if (existing) continue;

        // Get order details
        try {
          const orderRes = await fetch(`${IFOOD_API}/order/v1.0/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!orderRes.ok) {
            await orderRes.text();
            continue;
          }

          const orderText = await orderRes.text();
          if (!orderText) continue;
          const orderData = JSON.parse(orderText);

          const customerName = orderData.customer?.name || "Cliente iFood";
          const customerPhone = orderData.customer?.phone?.number || "";
          const deliveryAddress = orderData.delivery?.deliveryAddress
            ? `${orderData.delivery.deliveryAddress.streetName}, ${orderData.delivery.deliveryAddress.streetNumber} - ${orderData.delivery.deliveryAddress.neighborhood}, ${orderData.delivery.deliveryAddress.city}`
            : null;

          // ── Delivery fee with origin label ──────────────────────────────
          const deliveryFee = orderData.deliveryFee?.value
            ?? orderData.total?.deliveryFee
            ?? orderData.deliveryFee
            ?? 0;
          const deliveryFeeNum = typeof deliveryFee === 'object' ? (deliveryFee?.value || 0) : (deliveryFee || 0);

          // ── Payment type ────────────────────────────────────────────────
          let paymentType = "Pago pelo iFood";
          const paymentsObj = orderData.payments;
          if (paymentsObj && Array.isArray(paymentsObj.methods) && paymentsObj.methods.length > 0) {
            const p = paymentsObj.methods[0];
            const pType = (p.type || "").toUpperCase();
            const pMethod = (p.method || p.name || "").toUpperCase();
            const isPrepaid = p.prepaid === true;

            if (pType === "ONLINE" || isPrepaid) {
              paymentType = "Pago pelo iFood";
            } else if (pMethod.includes("CREDIT")) {
              paymentType = "Cartão de Crédito";
            } else if (pMethod.includes("DEBIT")) {
              paymentType = "Cartão de Débito";
            } else if (pMethod.includes("PIX")) {
              paymentType = "PIX";
            } else if (pMethod.includes("CASH")) {
              paymentType = "Dinheiro";
            } else {
              paymentType = "Pago pelo iFood";
            }
          }

          // Customer CPF
          const customerCpf = orderData.customer?.documentNumber || "Não informado";

          // ── Build notes with delivery fee origin ────────────────────────
          const orderNotes = deliveryFeeNum > 0
            ? `Pedido iFood #${orderId.slice(0, 8)} | Taxa de entrega: iFood (R$ ${deliveryFeeNum.toFixed(2)})`
            : `Pedido iFood #${orderId.slice(0, 8)}`;

          // Insert order
          const { data: insertedOrder, error: insertError } = await supabase
            .from("orders")
            .insert({
              restaurant_id,
              table_id: null,
              customer_name: customerName,
              customer_cpf: customerCpf,
              status: "pending",
              order_type: "delivery",
              delivery_type: "delivery",
              delivery_address: deliveryAddress,
              delivery_phone: customerPhone,
              delivery_fee: deliveryFeeNum,
              payment_type: paymentType,
              ifood_order_id: orderId,
              ifood_source: true,
              notes: orderNotes,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("Insert error:", insertError);
            continue;
          }

          if (insertedOrder) {
            newOrdersCount++;

            // ── Process items with PDV matching ───────────────────────────
            const insertItems: { itemData: any; extras: { name: string; price: number; matchedExtraId: string | null }[] }[] = [];

            if (orderData.items && orderData.items.length > 0) {
              for (const item of orderData.items) {
                const itemQty = item.quantity || 1;
                const itemName = item.name || "Item iFood";
                const externalCode = normalize(item.externalCode || "");

                // Base price: use totalPrice / qty (includes options)
                const rawUnitPrice = item.totalPrice != null
                  ? item.totalPrice / itemQty
                  : (item.unitPrice || item.price || 0);

                console.log(`[ifood-polling] ── ITEM: "${itemName}", externalCode="${item.externalCode || ""}", qty=${itemQty}, rawUnit=R$${rawUnitPrice.toFixed(2)}`);

                // ── Match product by externalCode → pdv_code, fallback by name ──
                let matchedProductId: string | null = null;

                if (externalCode) {
                  const match = productsList.find((p: any) => p.pdv_code && normalize(p.pdv_code) === externalCode);
                  if (match) {
                    matchedProductId = match.id;
                    console.log(`[ifood-polling]   ✓ MATCHED by externalCode "${item.externalCode}" → pdv_code "${match.pdv_code}" → "${match.name}"`);
                  }
                }

                if (!matchedProductId && itemName) {
                  const normalizedName = normalize(itemName);
                  let match = productsList.find((p: any) => normalize(p.name) === normalizedName);
                  if (!match) {
                    match = productsList.find((p: any) => normalize(p.name).includes(normalizedName) || normalizedName.includes(normalize(p.name)));
                  }
                  if (match) {
                    matchedProductId = match.id;
                    console.log(`[ifood-polling]   ✓ MATCHED by name "${itemName}" → "${match.name}"`);
                  } else {
                    console.log(`[ifood-polling]   ✗ No match for "${itemName}"`);
                  }
                }

                // ── Collect extras from options + customizations ──────────
                const collectedExtras: { name: string; price: number; matchedExtraId: string | null }[] = [];

                if (Array.isArray(item.options)) {
                  for (const opt of item.options) {
                    const optName = opt.name || "";
                    const optExternalCode = normalize(opt.externalCode || "");
                    const optPrice = opt.unitPrice || opt.price || 0;

                    if (!optName) continue;

                    // Try matching by externalCode → pdv_code in extra_category_items
                    let matchedExtraId: string | null = null;

                    if (optExternalCode) {
                      const extraMatch = extraCategoryItemsList.find((e: any) => e.pdv_code && normalize(e.pdv_code) === optExternalCode);
                      if (extraMatch) {
                        matchedExtraId = extraMatch.id;
                        console.log(`[ifood-polling]   ✓ OPTION "${optName}" matched by code "${opt.externalCode}" → "${extraMatch.name}"`);
                      }
                    }

                    if (!matchedExtraId) {
                      const normalizedOpt = normalize(optName);
                      const extraMatch = extraCategoryItemsList.find((e: any) => normalize(e.name) === normalizedOpt);
                      if (extraMatch) {
                        matchedExtraId = extraMatch.id;
                        console.log(`[ifood-polling]   ✓ OPTION "${optName}" matched by name → "${extraMatch.name}"`);
                      }
                    }

                    collectedExtras.push({ name: optName, price: optPrice, matchedExtraId });

                    // Also process customizations inside options
                    if (Array.isArray(opt.customization)) {
                      for (const cust of opt.customization) {
                        const custName = cust.name || "";
                        const custExternalCode = normalize(cust.externalCode || "");
                        const custPrice = cust.unitPrice || cust.price || 0;

                        if (!custName) continue;

                        let custMatchedId: string | null = null;

                        if (custExternalCode) {
                          const custMatch = extraCategoryItemsList.find((e: any) => e.pdv_code && normalize(e.pdv_code) === custExternalCode);
                          if (custMatch) {
                            custMatchedId = custMatch.id;
                            console.log(`[ifood-polling]   ✓ CUSTOMIZATION "${custName}" matched by code "${cust.externalCode}" → "${custMatch.name}"`);
                          }
                        }

                        if (!custMatchedId) {
                          const normalizedCust = normalize(custName);
                          const custMatch = extraCategoryItemsList.find((e: any) => normalize(e.name) === normalizedCust);
                          if (custMatch) {
                            custMatchedId = custMatch.id;
                          }
                        }

                        collectedExtras.push({ name: custName, price: custPrice, matchedExtraId: custMatchedId });
                      }
                    }
                  }
                }

                // ── Adjust base price: subtract extras to avoid double-counting ──
                const totalExtrasPrice = collectedExtras.reduce((sum, e) => sum + e.price, 0);
                const adjustedUnitPrice = totalExtrasPrice > 0 ? Math.max(0, rawUnitPrice - totalExtrasPrice) : rawUnitPrice;

                console.log(`[ifood-polling]   PRICING: raw=R$${rawUnitPrice.toFixed(2)}, extras=R$${totalExtrasPrice.toFixed(2)}, adjusted=R$${adjustedUnitPrice.toFixed(2)}, matched=${matchedProductId ? "YES" : "NO"}, extras_count=${collectedExtras.length}`);

                // Only put item name in notes if product was NOT matched
                const itemNotes = matchedProductId ? null : `[iFood] ${itemName}`;

                insertItems.push({
                  itemData: {
                    order_id: insertedOrder.id,
                    product_id: matchedProductId,
                    quantity: itemQty,
                    price_at_order: adjustedUnitPrice,
                    notes: itemNotes,
                  },
                  extras: collectedExtras,
                });
              }
            }

            // ── Insert all items + extras ─────────────────────────────────
            for (const entry of insertItems) {
              const { data: insertedItem, error: itemError } = await supabase
                .from("order_items")
                .insert(entry.itemData)
                .select("id")
                .single();

              if (itemError) {
                console.error("[ifood-polling] Error inserting item:", itemError);
                continue;
              }

              if (entry.extras.length > 0 && insertedItem) {
                const extrasToInsert = entry.extras.map((ex) => ({
                  order_item_id: insertedItem.id,
                  product_extra_id: null,
                  price_at_order: ex.price,
                  extra_name: ex.name,
                }));

                const { error: extrasError } = await supabase.from("order_item_extras").insert(extrasToInsert);
                if (extrasError) {
                  console.error("[ifood-polling] Error inserting extras:", extrasError);
                } else {
                  console.log(`[ifood-polling]   ✓ ${extrasToInsert.length} extras inserted for item ${insertedItem.id}`);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error processing iFood order:", e);
        }
      } else if (eventCode === "CONFIRMED") {
        await supabase
          .from("orders")
          .update({ status: "accepted" })
          .eq("ifood_order_id", orderId)
          .eq("restaurant_id", restaurant_id);
      } else if (eventCode === "CANCELLED" || eventCode === "CANCELLATION_REQUESTED") {
        await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("ifood_order_id", orderId)
          .eq("restaurant_id", restaurant_id);
      } else if (eventCode === "CONCLUSION") {
        await supabase
          .from("orders")
          .update({ status: "delivered" })
          .eq("ifood_order_id", orderId)
          .eq("restaurant_id", restaurant_id);
      }
    }

    // Acknowledge events
    if (eventIds.length > 0) {
      try {
        await fetch(`${IFOOD_API}/events/v1.0/events/acknowledgment`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventIds),
        });
      } catch (e) {
        console.error("Failed to acknowledge events:", e);
      }
    }

    // Update last polling time
    await supabase
      .from("ifood_config")
      .update({ last_polling_at: new Date().toISOString() })
      .eq("restaurant_id", restaurant_id);

    return new Response(
      JSON.stringify({ success: true, new_orders: newOrdersCount, events_processed: eventIds.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ifood-polling error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
