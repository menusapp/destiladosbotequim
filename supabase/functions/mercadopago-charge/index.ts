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
    } = await req.json();

    // Round amount to 2 decimal places and validate
    const roundedAmount = Math.round(Number(amount) * 100) / 100;

    if (!restaurant_id || !roundedAmount || roundedAmount <= 0 || !billing_type) {
      return new Response(
        JSON.stringify({ error: "Valor inválido ou dados obrigatórios ausentes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build additional_info.items for MP anti-fraud, filtering out zero-price items
    const mpItems = Array.isArray(items) && items.length > 0
      ? items
          .filter((item: any) => Number(item.unit_price) > 0)
          .map((item: any) => ({
            id: item.id || "unknown",
            title: item.name || "Produto",
            description: item.name || "Produto",
            quantity: item.quantity || 1,
            unit_price: Math.round(Number(item.unit_price) * 100) / 100,
            category_id: "food",
          }))
      : [];

    // Fallback if all items were filtered out
    if (mpItems.length === 0) {
      mpItems.push({
        id: "order",
        title: `Pedido ${order_id || "delivery"}`,
        description: "Pedido delivery",
        quantity: 1,
        unit_price: roundedAmount,
        category_id: "food",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch restaurant's MP access token
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

    let mpResponse: Response;
    let mpData: any;

    if (billing_type === "PIX") {
      mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
          "X-Idempotency-Key": `${restaurant_id}-${order_id || Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: roundedAmount,
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

      mpData = await mpResponse.json();

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
          restaurant_id,
          order_id: order_id || null,
          amount: roundedAmount,
          provider: "mercadopago",
          provider_payment_id: String(mpData.id),
          status: "pending",
          payment_method: "pix",
          customer_name,
          customer_cpf,
          customer_email,
          customer_phone,
          pix_qr_code: pixData?.qr_code || null,
          pix_qr_code_base64: pixData?.qr_code_base64 || null,
          pix_expiration: mpData.date_of_expiration || null,
        })
        .select("id")
        .single();

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
    } else if (billing_type === "CREDIT_CARD") {
      mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
          "X-Idempotency-Key": `${restaurant_id}-${order_id || Date.now()}-cc`,
        },
        body: JSON.stringify({
          transaction_amount: roundedAmount,
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
        }),
      });

      mpData = await mpResponse.json();

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
          restaurant_id,
          order_id: order_id || null,
          amount: roundedAmount,
          provider: "mercadopago",
          provider_payment_id: String(mpData.id),
          status: isApproved ? "confirmed" : "pending",
          payment_method: "credit_card",
          customer_name,
          customer_cpf,
          customer_email,
          customer_phone,
          paid_at: isApproved ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

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
