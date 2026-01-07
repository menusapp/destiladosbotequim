import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API_URL = "https://api.mercadopago.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { 
      restaurantId, 
      orderId, 
      amount, 
      description, 
      paymentMethod, 
      customer,
      callbackUrl 
    } = body;

    // Validações
    if (!restaurantId || !amount || !paymentMethod || !customer?.name || !customer?.cpf) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios não fornecidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração do restaurante
    const { data: config, error: configError } = await supabase
      .from("online_payment_config")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Pagamento online não configurado para este restaurante" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.enabled || config.connection_status !== "connected") {
      return new Response(
        JSON.stringify({ error: "Pagamento online não está ativo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.mp_access_token) {
      return new Response(
        JSON.stringify({ error: "Conta Mercado Pago não conectada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar método de pagamento
    if (paymentMethod === "pix" && !config.accept_pix) {
      return new Response(
        JSON.stringify({ error: "Pix não está habilitado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (paymentMethod === "credit_card" && !config.accept_card) {
      return new Response(
        JSON.stringify({ error: "Cartão não está habilitado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do restaurante para descrição
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .single();

    const paymentDescription = description || `Pedido - ${restaurant?.name || 'Restaurante'}`;

    // Criar registro de pagamento no banco
    const { data: payment, error: paymentError } = await supabase
      .from("online_payments")
      .insert({
        restaurant_id: restaurantId,
        order_id: orderId || null,
        provider: "mercadopago",
        amount: amount,
        status: "pending",
        payment_method: paymentMethod,
        customer_name: customer.name,
        customer_email: customer.email || null,
        customer_cpf: customer.cpf,
        customer_phone: customer.phone || null
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      throw paymentError;
    }

    // Preparar dados para API do Mercado Pago
    const mpPayload: any = {
      transaction_amount: parseFloat(amount.toFixed(2)),
      description: paymentDescription,
      payment_method_id: paymentMethod === "pix" ? "pix" : undefined,
      payer: {
        email: customer.email || `${customer.cpf}@temp.com`,
        first_name: customer.name.split(" ")[0],
        last_name: customer.name.split(" ").slice(1).join(" ") || customer.name,
        identification: {
          type: "CPF",
          number: customer.cpf.replace(/\D/g, "")
        }
      },
      external_reference: payment.id,
      notification_url: `${supabaseUrl}/functions/v1/payment-webhook`
    };

    let result: any;

    if (paymentMethod === "pix") {
      // Criar pagamento Pix diretamente
      const mpResponse = await fetch(`${MP_API_URL}/v1/payments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.mp_access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": payment.id
        },
        body: JSON.stringify(mpPayload)
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("MP payment error:", mpData);
        
        // Atualizar status do pagamento para falha
        await supabase
          .from("online_payments")
          .update({ status: "rejected" })
          .eq("id", payment.id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: mpData.message || "Erro ao criar pagamento no Mercado Pago" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar com dados do MP
      const pixExpiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
      
      await supabase
        .from("online_payments")
        .update({
          provider_payment_id: mpData.id?.toString(),
          pix_qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
          pix_qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
          pix_expiration: pixExpiration.toISOString()
        })
        .eq("id", payment.id);

      result = {
        success: true,
        paymentId: payment.id,
        status: "pending",
        pixQrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
        pixQrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 
          ? `data:image/png;base64,${mpData.point_of_interaction.transaction_data.qr_code_base64}` 
          : null,
        pixExpiration: pixExpiration.toISOString()
      };

    } else {
      // Para cartão, criar preferência (checkout Pro)
      const preferencePayload = {
        items: [{
          title: paymentDescription,
          quantity: 1,
          unit_price: parseFloat(amount.toFixed(2)),
          currency_id: "BRL"
        }],
        payer: mpPayload.payer,
        external_reference: payment.id,
        notification_url: `${supabaseUrl}/functions/v1/payment-webhook`,
        back_urls: {
          success: callbackUrl || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/delivery?payment=success`,
          failure: callbackUrl || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/delivery?payment=failure`,
          pending: callbackUrl || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/delivery?payment=pending`
        },
        auto_return: "approved",
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
          installments: 12
        }
      };

      const mpResponse = await fetch(`${MP_API_URL}/checkout/preferences`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.mp_access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(preferencePayload)
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("MP preference error:", mpData);
        
        await supabase
          .from("online_payments")
          .update({ status: "rejected" })
          .eq("id", payment.id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: mpData.message || "Erro ao criar checkout" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar com ID da preferência
      await supabase
        .from("online_payments")
        .update({
          provider_preference_id: mpData.id
        })
        .eq("id", payment.id);

      result = {
        success: true,
        paymentId: payment.id,
        status: "pending",
        checkoutUrl: mpData.init_point
      };
    }

    // Vincular pagamento ao pedido se existir
    if (orderId) {
      await supabase
        .from("orders")
        .update({ 
          online_payment_id: payment.id,
          payment_status: "pending"
        })
        .eq("id", orderId);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("payment-create error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
