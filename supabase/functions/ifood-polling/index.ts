import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IFOOD_API = "https://merchant-api.ifood.com.br";

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
      // No events — update polling time and return
      await supabase
        .from("ifood_config")
        .update({ last_polling_at: new Date().toISOString() })
        .eq("restaurant_id", restaurant_id);

      return new Response(
        JSON.stringify({ success: true, new_orders: 0, events_processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let newOrdersCount = 0;
    const eventIds: { id: string }[] = [];

    for (const event of events) {
      eventIds.push({ id: event.id });
      const eventCode = event.fullCode || event.code || "";
      const orderId = event.orderId;
      console.log("Evento recebido:", JSON.stringify({ id: event.id, code: event.code, fullCode: event.fullCode, orderId: event.orderId }));

      if (eventCode === "PLACED") {
        // Check if order already exists to avoid duplicate insert errors
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("ifood_order_id", orderId)
          .maybeSingle();

        console.log("Pedido PLACED - existing:", existing, "orderId:", orderId);
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

          // table_id is nullable — iFood orders don't use tables

          // Use totalPrice from iFood (includes item + all complements)
          let calculatedTotal = 0;
          const orderItems: any[] = [];

          if (orderData.items && orderData.items.length > 0) {
            for (const item of orderData.items) {
              const itemQty = item.quantity || 1;
              // totalPrice already includes item + options + customizations
              const pricePerUnit = item.totalPrice != null
                ? item.totalPrice / itemQty
                : (item.unitPrice || item.price || 0);
              calculatedTotal += (item.totalPrice != null ? item.totalPrice : pricePerUnit * itemQty);

              // Build notes: item name + options + customizations
              let itemNotes = item.name || "Item iFood";
              const optionNames: string[] = [];
              if (Array.isArray(item.options)) {
                for (const opt of item.options) {
                  let optLabel = opt.name || "";
                  if (Array.isArray(opt.customization) && opt.customization.length > 0) {
                    const custNames = opt.customization.map((c: any) => c.name).filter(Boolean);
                    if (custNames.length > 0) {
                      optLabel += ` (${custNames.join(", ")})`;
                    }
                  }
                  if (optLabel) optionNames.push(optLabel);
                }
              }
              if (optionNames.length > 0) {
                itemNotes += " — " + optionNames.join(", ");
              }

              orderItems.push({
                quantity: itemQty,
                price_at_order: pricePerUnit,
                notes: itemNotes,
              });
            }
          }

          // Delivery fee
          const deliveryFee = orderData.deliveryFee?.value
            ?? orderData.total?.deliveryFee
            ?? orderData.deliveryFee
            ?? 0;
          const deliveryFeeNum = typeof deliveryFee === 'object' ? (deliveryFee?.value || 0) : (deliveryFee || 0);

          // Map payment type — iFood uses payments.methods[]
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
              notes: `Pedido iFood #${orderId.slice(0, 8)}`,
            })
            .select("id")
            .single();

          console.log("Insert error:", insertError);
          console.log("Insert result:", insertedOrder);

          if (!insertError && insertedOrder) {
            newOrdersCount++;

            // Insert order items
            if (orderItems.length > 0) {
              const dbItems = orderItems.map((item) => ({
                order_id: insertedOrder.id,
                product_id: null,
                quantity: item.quantity,
                price_at_order: item.price_at_order,
                notes: item.notes,
              }));

              await supabase.from("order_items").insert(dbItems);
            }
          }
        } catch (e) {
          console.error("Error processing iFood order:", e);
        }
      } else if (eventCode === "CONFIRMED") {
        // Update order status to accepted
        await supabase
          .from("orders")
          .update({ status: "accepted" })
          .eq("ifood_order_id", orderId)
          .eq("restaurant_id", restaurant_id);
      } else if (eventCode === "CANCELLED" || eventCode === "CANCELLATION_REQUESTED") {
        // Update order status to cancelled
        await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("ifood_order_id", orderId)
          .eq("restaurant_id", restaurant_id);
      } else if (eventCode === "CONCLUSION") {
        // Update order status to delivered
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
