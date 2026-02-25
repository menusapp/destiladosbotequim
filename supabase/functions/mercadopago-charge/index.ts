import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      restaurant_id,
      order_id,
      amount,
      billing_type,
      customer_name,
      customer_cpf,
      customer_email,
      customer_phone,
      card_token,
      payment_method_id,
      installments,
      items,
      // Saved card fields
      save_card,
      saved_card_id,
    } = await req.json();

    // Build additional_info.items for MP anti-fraud
    const mpItems = Array.isArray(items) && items.length > 0
      ? items.map((item: any) => ({
          id: item.id || "unknown",
          title: item.name || "Produto",
          description: item.name || "Produto",
          quantity: item.quantity || 1,
          unit_price: Number(item.unit_price) || 0,
          category_id: "food",
        }))
      : [{ id: "order", title: `Pedido ${order_id || "delivery"}`, description: "Pedido delivery", quantity: 1, unit_price: amount, category_id: "food" }];

    if (!restaurant_id || !amount || !billing_type) {
      return new Response(
        JSON.stringify({ error: "restaurant_id, amount e billing_type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await supabase
      .from("online_payment_config")
      .select("mp_access_token, mp_public_key")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (configError || !config?.mp_access_token) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago não configurado para este restaurante" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpAccessToken = config.mp_access_token;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // ─── PIX ───
    if (billing_type === "PIX") {
      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
          "X-Idempotency-Key": `${restaurant_id}-${order_id || Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          payment_method_id: "pix",
          notification_url: webhookUrl,
          external_reference: order_id || `ref-${restaurant_id}-${Date.now()}`,
          payer: {
            email: customer_email || "cliente@email.com",
            first_name: customer_name || "Cliente",
            identification: customer_cpf
              ? { type: "CPF", number: customer_cpf.replace(/\D/g, "") }
              : undefined,
          },
          description: `Pedido ${order_id || "delivery"}`,
          additional_info: { items: mpItems },
        }),
      });

      const mpData = await mpResponse.json();
      if (!mpResponse.ok) {
        console.error("[MP Charge] PIX error:", JSON.stringify(mpData));
        return new Response(
          JSON.stringify({ error: mpData.message || "Erro ao gerar Pix no Mercado Pago" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pixData = mpData.point_of_interaction?.transaction_data;
      const { data: payment, error: paymentError } = await supabase
        .from("online_payments")
        .insert({
          restaurant_id, order_id: order_id || null, amount,
          provider: "mercadopago", provider_payment_id: String(mpData.id),
          status: "pending", payment_method: "pix",
          customer_name, customer_cpf, customer_email, customer_phone,
          pix_qr_code: pixData?.qr_code || null,
          pix_qr_code_base64: pixData?.qr_code_base64 || null,
          pix_expiration: mpData.date_of_expiration || null,
        })
        .select("id").single();

      if (paymentError) {
        console.error("[MP Charge] DB error:", paymentError);
        return new Response(
          JSON.stringify({ error: "Erro ao salvar pagamento" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          online_payment_id: payment.id,
          pix_qr_code: pixData?.qr_code,
          pix_qr_code_base64: pixData?.qr_code_base64,
          pix_expiration: mpData.date_of_expiration,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CREDIT CARD ───
    if (billing_type === "CREDIT_CARD") {
      let paymentBody: any;

      // ── Pay with SAVED card ──
      if (saved_card_id) {
        const { data: savedCard, error: cardErr } = await supabase
          .from("customer_cards")
          .select("*")
          .eq("id", saved_card_id)
          .eq("restaurant_id", restaurant_id)
          .maybeSingle();

        if (cardErr || !savedCard) {
          return new Response(
            JSON.stringify({ error: "Cartão salvo não encontrado" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        paymentBody = {
          transaction_amount: amount,
          token: savedCard.card_id,
          payment_method_id: savedCard.payment_method_id,
          installments: installments || 1,
          notification_url: webhookUrl,
          external_reference: order_id || `ref-${restaurant_id}-${Date.now()}`,
          payer: {
            id: savedCard.mp_customer_id,
            email: customer_email || "cliente@email.com",
            first_name: customer_name || "Cliente",
            identification: customer_cpf
              ? { type: "CPF", number: customer_cpf.replace(/\D/g, "") }
              : undefined,
          },
          description: `Pedido ${order_id || "delivery"}`,
          additional_info: { items: mpItems },
        };
      } else {
        // ── Pay with NEW card token ──
        paymentBody = {
          transaction_amount: amount,
          token: card_token,
          payment_method_id: payment_method_id,
          installments: installments || 1,
          notification_url: webhookUrl,
          external_reference: order_id || `ref-${restaurant_id}-${Date.now()}`,
          payer: {
            email: customer_email || "cliente@email.com",
            first_name: customer_name || "Cliente",
            identification: customer_cpf
              ? { type: "CPF", number: customer_cpf.replace(/\D/g, "") }
              : undefined,
          },
          description: `Pedido ${order_id || "delivery"}`,
          additional_info: { items: mpItems },
        };
      }

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
          "X-Idempotency-Key": `${restaurant_id}-${order_id || Date.now()}-cc`,
        },
        body: JSON.stringify(paymentBody),
      });

      const mpData = await mpResponse.json();
      if (!mpResponse.ok) {
        console.error("[MP Charge] Card error:", JSON.stringify(mpData));
        return new Response(
          JSON.stringify({ error: mpData.message || "Erro ao processar cartão" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isApproved = mpData.status === "approved";

      const { data: payment, error: paymentError } = await supabase
        .from("online_payments")
        .insert({
          restaurant_id, order_id: order_id || null, amount,
          provider: "mercadopago", provider_payment_id: String(mpData.id),
          status: isApproved ? "confirmed" : "pending",
          payment_method: "credit_card",
          customer_name, customer_cpf, customer_email, customer_phone,
          paid_at: isApproved ? new Date().toISOString() : null,
        })
        .select("id").single();

      if (paymentError) {
        console.error("[MP Charge] DB error:", paymentError);
        return new Response(
          JSON.stringify({ error: "Erro ao salvar pagamento" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Save card if requested and payment approved ──
      if (save_card && isApproved && card_token && !saved_card_id) {
        try {
          await saveCardForCustomer({
            mpAccessToken,
            supabase,
            restaurant_id,
            customer_cpf,
            customer_phone,
            customer_email,
            card_token,
            payment_method_id,
          });
        } catch (e) {
          console.warn("[MP Charge] Failed to save card (non-blocking):", e);
        }
      }

      return new Response(
        JSON.stringify({
          online_payment_id: payment.id,
          confirmed: isApproved,
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "billing_type inválido. Use PIX ou CREDIT_CARD" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[MP Charge] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helper: Save card to MP Customer + our DB ───
async function saveCardForCustomer({
  mpAccessToken, supabase, restaurant_id, customer_cpf, customer_phone, customer_email, card_token, payment_method_id,
}: any) {
  const cleanCpf = customer_cpf?.replace(/\D/g, "") || "";

  // Check if customer already has an mp_customer_id for this restaurant
  const { data: existing } = await supabase
    .from("customer_cards")
    .select("mp_customer_id")
    .eq("restaurant_id", restaurant_id)
    .eq("customer_cpf", cleanCpf)
    .limit(1)
    .maybeSingle();

  let mpCustomerId = existing?.mp_customer_id;

  // Create MP Customer if needed
  if (!mpCustomerId) {
    const customerRes = await fetch("https://api.mercadopago.com/v1/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify({
        email: customer_email || `${cleanCpf}@placeholder.com`,
        identification: { type: "CPF", number: cleanCpf },
      }),
    });

    const customerData = await customerRes.json();
    
    // If customer already exists (409), search for it
    if (customerRes.status === 409 || customerData?.cause?.[0]?.code === "101") {
      const searchRes = await fetch(
        `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(customer_email || `${cleanCpf}@placeholder.com`)}`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
      );
      const searchData = await searchRes.json();
      mpCustomerId = searchData?.results?.[0]?.id;
    } else if (customerData?.id) {
      mpCustomerId = customerData.id;
    }

    if (!mpCustomerId) {
      throw new Error("Failed to create/find MP Customer");
    }
  }

  // Save card to MP Customer
  const cardRes = await fetch(`https://api.mercadopago.com/v1/customers/${mpCustomerId}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mpAccessToken}`,
    },
    body: JSON.stringify({ token: card_token }),
  });

  const cardData = await cardRes.json();
  if (!cardData?.id) {
    console.warn("[MP Charge] Card save response:", JSON.stringify(cardData));
    throw new Error("Failed to save card to MP");
  }

  // Insert into our DB
  await supabase.from("customer_cards").upsert({
    restaurant_id,
    customer_cpf: cleanCpf,
    customer_phone: customer_phone || "",
    mp_customer_id: mpCustomerId,
    card_id: cardData.id,
    last_four_digits: cardData.last_four_digits || "****",
    payment_method_id: cardData.payment_method?.id || payment_method_id || "unknown",
    first_six_digits: cardData.first_six_digits || null,
    expiration_month: cardData.expiration_month || null,
    expiration_year: cardData.expiration_year || null,
  }, { onConflict: "restaurant_id,customer_cpf,card_id" });

  console.log(`[MP Charge] Card saved: ${cardData.last_four_digits} for CPF ${cleanCpf}`);
}
