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
          merchantId = payload.merchant_id || payload.merchantId || payload.sub || null;
          // Save it back so we don't decode every time
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

    // Check token expiry (30 min buffer)
    const expiresAt = new Date(config.token_expires_at).getTime();
    const now = Date.now();
    if (expiresAt - now < 30 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Token expiring soon, needs refresh" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll events
    const eventsRes = await fetch(`${IFOOD_API}/events/v1.0/events:polling`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
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
      const eventCode = event.code || event.fullCode || "";
      const orderId = event.orderId;

      if (eventCode === "PLACED") {
        // Check if order already exists to avoid duplicate insert errors
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("ifood_order_id", orderId)
          .maybeSingle();

        if (existing) continue;

        // Get order details
        try {
          const orderRes = await fetch(`${IFOOD_API}/order/v1.0/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${config.access_token}` },
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

          // Get a dummy table for delivery orders (table_id is required)
          const { data: dummyTable } = await supabase
            .from("tables")
            .select("id")
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .single();

          if (!dummyTable) continue;

          // Calculate total
          const totalPrice = orderData.total?.orderAmount || orderData.totalPrice || 0;
          const deliveryFee = orderData.total?.deliveryFee || orderData.deliveryFee || 0;

          // Map payment type
          let paymentType = "pending";
          if (orderData.payments && orderData.payments.length > 0) {
            const p = orderData.payments[0];
            const method = (p.method || p.name || "").toLowerCase();
            if (method.includes("credit") || method.includes("crédito")) paymentType = "credit";
            else if (method.includes("debit") || method.includes("débito")) paymentType = "debit";
            else if (method.includes("pix")) paymentType = "pix";
            else if (method.includes("cash") || method.includes("dinheiro")) paymentType = "cash";
            else if (method.includes("meal") || method.includes("voucher") || method.includes("vale")) paymentType = "meal_voucher";
            else paymentType = p.method || "other";
          }

          // Insert order
          const { data: insertedOrder, error: insertError } = await supabase
            .from("orders")
            .insert({
              restaurant_id,
              table_id: dummyTable.id,
              customer_name: customerName,
              customer_cpf: "000.000.000-00",
              status: "pending",
              order_type: "delivery",
              delivery_type: "delivery",
              delivery_address: deliveryAddress,
              delivery_phone: customerPhone,
              delivery_fee: deliveryFee,
              payment_type: paymentType,
              ifood_order_id: orderId,
              ifood_source: true,
              notes: `Pedido iFood #${orderId.slice(0, 8)}`,
            })
            .select("id")
            .single();

          if (!insertError && insertedOrder) {
            newOrdersCount++;

            // Insert order items from iFood data
            if (orderData.items && orderData.items.length > 0) {
              const orderItems = orderData.items.map((item: any) => ({
                order_id: insertedOrder.id,
                product_id: null,
                quantity: item.quantity || 1,
                price_at_order: item.unitPrice || item.price || 0,
                notes: item.name || "Item iFood",
              }));

              await supabase.from("order_items").insert(orderItems);
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
            Authorization: `Bearer ${config.access_token}`,
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
