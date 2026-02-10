import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasEnv = Deno.env.get("ASAAS_ENVIRONMENT") || "sandbox";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const baseUrl =
      asaasEnv === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

    const body = await req.json();
    const {
      restaurant_id,
      order_id,
      amount,
      billing_type, // "PIX" or "CREDIT_CARD"
      customer_name,
      customer_cpf,
      customer_email,
      customer_phone,
      // Credit card fields (only for CREDIT_CARD)
      card_holder_name,
      card_number,
      card_expiry_month,
      card_expiry_year,
      card_ccv,
      card_holder_cpf,
      card_holder_email,
      card_holder_phone,
      card_holder_postal_code,
      card_holder_address_number,
    } = body;

    // Validate required fields
    if (!restaurant_id || !amount || !billing_type) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: restaurant_id, amount, billing_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customer_cpf || !customer_name) {
      return new Response(
        JSON.stringify({ error: "Dados do cliente obrigatórios: customer_cpf, customer_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get restaurant's Asaas API key
    const { data: paymentConfig, error: configError } = await supabase
      .from("online_payment_config")
      .select("asaas_api_key, connection_status")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (configError || !paymentConfig?.asaas_api_key) {
      console.error("[asaas-charge] Config error:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração de pagamento não encontrada para este restaurante" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paymentConfig.connection_status !== "connected") {
      return new Response(
        JSON.stringify({ error: "Conta de pagamentos ainda não está ativa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subAccountApiKey = paymentConfig.asaas_api_key;
    const cleanCpf = customer_cpf.replace(/\D/g, "");

    // 2. Find or create customer in Asaas
    let asaasCustomerId: string;

    // Check local cache first
    const { data: cachedCustomer } = await supabase
      .from("asaas_customers")
      .select("asaas_customer_id")
      .eq("restaurant_id", restaurant_id)
      .eq("customer_cpf", cleanCpf)
      .maybeSingle();

    if (cachedCustomer?.asaas_customer_id) {
      asaasCustomerId = cachedCustomer.asaas_customer_id;
      console.log("[asaas-charge] Using cached customer:", asaasCustomerId);
    } else {
      // Search in Asaas by CPF
      const searchRes = await fetch(
        `${baseUrl}/customers?cpfCnpj=${cleanCpf}`,
        {
          headers: { access_token: subAccountApiKey },
        }
      );
      const searchData = await searchRes.json();

      if (searchData.data && searchData.data.length > 0) {
        asaasCustomerId = searchData.data[0].id;
        console.log("[asaas-charge] Found existing customer:", asaasCustomerId);
      } else {
        // Create new customer
        const createRes = await fetch(`${baseUrl}/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: subAccountApiKey,
          },
          body: JSON.stringify({
            name: customer_name,
            cpfCnpj: cleanCpf,
            email: customer_email || undefined,
            mobilePhone: (customer_phone || "").replace(/\D/g, "") || undefined,
          }),
        });
        const createData = await createRes.json();

        if (!createRes.ok) {
          console.error("[asaas-charge] Error creating customer:", JSON.stringify(createData));
          return new Response(
            JSON.stringify({ error: "Erro ao criar cliente no gateway de pagamento", details: createData }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        asaasCustomerId = createData.id;
        console.log("[asaas-charge] Created new customer:", asaasCustomerId);
      }

      // Cache the customer mapping
      await supabase.from("asaas_customers").upsert({
        restaurant_id,
        customer_cpf: cleanCpf,
        asaas_customer_id: asaasCustomerId,
      }, { onConflict: "restaurant_id,customer_cpf" });
    }

    // 3. Create payment
    const paymentPayload: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value: amount,
      dueDate: new Date().toISOString().split("T")[0], // Today
      description: order_id ? `Pedido #${order_id.slice(0, 8)}` : "Pagamento online",
    };

    // Add credit card data if applicable
    if (billing_type === "CREDIT_CARD") {
      if (!card_number || !card_holder_name || !card_expiry_month || !card_expiry_year || !card_ccv) {
        return new Response(
          JSON.stringify({ error: "Dados do cartão são obrigatórios para pagamento com cartão" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      paymentPayload.creditCard = {
        holderName: card_holder_name,
        number: card_number.replace(/\D/g, ""),
        expiryMonth: card_expiry_month,
        expiryYear: card_expiry_year,
        ccv: card_ccv,
      };

      paymentPayload.creditCardHolderInfo = {
        name: card_holder_name,
        cpfCnpj: (card_holder_cpf || customer_cpf).replace(/\D/g, ""),
        email: card_holder_email || customer_email || "cliente@email.com",
        phone: (card_holder_phone || customer_phone || "").replace(/\D/g, ""),
        postalCode: (card_holder_postal_code || "").replace(/\D/g, ""),
        addressNumber: card_holder_address_number || "0",
      };
    }

    console.log("[asaas-charge] Creating payment:", JSON.stringify({
      ...paymentPayload,
      creditCard: paymentPayload.creditCard ? "***REDACTED***" : undefined,
    }));

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: subAccountApiKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("[asaas-charge] Payment error:", JSON.stringify(paymentData));
      const errorMsg =
        paymentData.errors?.map((e: any) => e.description).join(", ") ||
        "Erro ao criar cobrança";
      return new Response(
        JSON.stringify({ error: errorMsg, details: paymentData }),
        { status: paymentRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[asaas-charge] Payment created:", paymentData.id, "status:", paymentData.status);

    // 4. For PIX, get QR Code
    let pixData = null;
    if (billing_type === "PIX") {
      // Wait a moment for the payment to be fully processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: subAccountApiKey },
      });

      if (pixRes.ok) {
        pixData = await pixRes.json();
        console.log("[asaas-charge] PIX QR Code generated successfully");
      } else {
        console.error("[asaas-charge] Error fetching PIX QR Code:", await pixRes.text());
      }
    }

    // 5. Save to online_payments table
    const onlinePaymentData: Record<string, unknown> = {
      restaurant_id,
      order_id: order_id || null,
      amount,
      provider: "asaas",
      provider_payment_id: paymentData.id,
      payment_method: billing_type === "PIX" ? "pix" : "credit_card",
      status: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED"
        ? "confirmed"
        : "pending",
      customer_cpf: cleanCpf,
      customer_name,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      pix_qr_code: pixData?.payload || null,
      pix_qr_code_base64: pixData?.encodedImage || null,
      pix_expiration: pixData ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
      paid_at: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED"
        ? new Date().toISOString()
        : null,
    };

    const { data: savedPayment, error: saveError } = await supabase
      .from("online_payments")
      .insert(onlinePaymentData)
      .select()
      .single();

    if (saveError) {
      console.error("[asaas-charge] Error saving payment:", saveError);
    }

    // 6. If credit card was confirmed immediately, update order
    if (
      (paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED") &&
      order_id
    ) {
      await supabase
        .from("orders")
        .update({
          payment_status: "confirmed",
          online_payment_id: savedPayment?.id || null,
        })
        .eq("id", order_id);
    }

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        online_payment_id: savedPayment?.id || null,
        status: paymentData.status,
        billing_type,
        // PIX data
        pix_qr_code: pixData?.payload || null,
        pix_qr_code_base64: pixData?.encodedImage || null,
        pix_expiration: pixData ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
        // Credit card data
        confirmed: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[asaas-charge] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
