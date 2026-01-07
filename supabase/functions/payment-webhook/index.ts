import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API_URL = "https://api.mercadopago.com";

serve(async (req) => {
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
    console.log("Webhook received:", JSON.stringify(body));

    // Mercado Pago envia diferentes tipos de notificação
    const { type, data, action } = body;

    // Verificar se é uma notificação de pagamento
    if (type !== "payment" && action?.indexOf("payment") === -1) {
      // Ignorar outros tipos de notificação
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentIdMP = data?.id;
    if (!paymentIdMP) {
      console.log("No payment ID in webhook");
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nosso registro de pagamento pelo provider_payment_id
    let { data: payment, error: findError } = await supabase
      .from("online_payments")
      .select("*, restaurant_id, order_id")
      .eq("provider_payment_id", paymentIdMP.toString())
      .maybeSingle();

    // Se não encontrou, pode ser que ainda não foi atualizado com o ID do MP
    // Tentar buscar o pagamento na API do MP para pegar o external_reference
    if (!payment) {
      console.log("Payment not found by provider_payment_id, fetching from MP API...");
      
      // Precisamos de um access_token para consultar a API do MP
      // Vamos tentar com todos os restaurantes que têm conexão ativa
      const { data: configs } = await supabase
        .from("online_payment_config")
        .select("restaurant_id, mp_access_token")
        .eq("connection_status", "connected")
        .not("mp_access_token", "is", null);

      for (const config of configs || []) {
        try {
          const mpResponse = await fetch(`${MP_API_URL}/v1/payments/${paymentIdMP}`, {
            headers: { "Authorization": `Bearer ${config.mp_access_token}` }
          });

          if (mpResponse.ok) {
            const mpData = await mpResponse.json();
            const externalRef = mpData.external_reference;

            if (externalRef) {
              // Buscar por nosso ID interno
              const { data: foundPayment } = await supabase
                .from("online_payments")
                .select("*, restaurant_id, order_id")
                .eq("id", externalRef)
                .single();

              if (foundPayment) {
                payment = foundPayment;
                
                // Atualizar o provider_payment_id
                await supabase
                  .from("online_payments")
                  .update({ provider_payment_id: paymentIdMP.toString() })
                  .eq("id", externalRef);
                
                break;
              }
            }
          }
        } catch (e) {
          console.log("Error fetching from MP:", e);
        }
      }
    }

    if (!payment) {
      console.log("Payment still not found after MP lookup");
      return new Response(
        JSON.stringify({ received: true, warning: "Payment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar detalhes atualizados do pagamento na API do MP
    const { data: config } = await supabase
      .from("online_payment_config")
      .select("mp_access_token")
      .eq("restaurant_id", payment.restaurant_id)
      .single();

    if (!config?.mp_access_token) {
      console.log("No access token for restaurant");
      return new Response(
        JSON.stringify({ received: true, error: "No access token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Consultar status atual no MP
    const mpResponse = await fetch(`${MP_API_URL}/v1/payments/${paymentIdMP}`, {
      headers: { "Authorization": `Bearer ${config.mp_access_token}` }
    });

    if (!mpResponse.ok) {
      console.error("Error fetching payment from MP:", await mpResponse.text());
      return new Response(
        JSON.stringify({ received: true, error: "Failed to fetch from MP" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpPayment = await mpResponse.json();
    console.log("MP payment status:", mpPayment.status);

    // Mapear status do MP para nosso sistema
    let newStatus: string;
    let paidAt: string | null = null;

    switch (mpPayment.status) {
      case "approved":
        newStatus = "approved";
        paidAt = new Date().toISOString();
        break;
      case "rejected":
        newStatus = "rejected";
        break;
      case "cancelled":
        newStatus = "cancelled";
        break;
      case "refunded":
        newStatus = "refunded";
        break;
      case "in_process":
      case "pending":
      case "authorized":
      default:
        newStatus = "pending";
    }

    // Atualizar nosso registro de pagamento
    await supabase
      .from("online_payments")
      .update({
        status: newStatus,
        paid_at: paidAt,
        payment_method: mpPayment.payment_method_id || payment.payment_method,
        webhook_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", payment.id);

    // Atualizar status do pedido se existir
    if (payment.order_id) {
      const orderUpdate: any = {
        payment_status: newStatus === "approved" ? "paid" : newStatus
      };

      // Se pagamento aprovado, atualizar status do pedido para pending (aguardando preparo)
      if (newStatus === "approved") {
        orderUpdate.status = "pending";
      }

      await supabase
        .from("orders")
        .update(orderUpdate)
        .eq("id", payment.order_id);

      // Enviar WhatsApp se configurado
      if (newStatus === "approved" || newStatus === "rejected") {
        await sendWhatsAppNotification(
          supabase,
          payment.restaurant_id,
          payment.order_id,
          newStatus,
          supabaseUrl
        );
      }
    }

    return new Response(
      JSON.stringify({ received: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("payment-webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendWhatsAppNotification(
  supabase: any,
  restaurantId: string,
  orderId: string,
  paymentStatus: string,
  supabaseUrl: string
) {
  try {
    // Buscar configuração do WhatsApp
    const { data: whatsappConfig } = await supabase
      .from("whatsapp_config")
      .select("enabled, instance_status, message_payment_approved, message_payment_rejected")
      .eq("restaurant_id", restaurantId)
      .single();

    if (!whatsappConfig?.enabled || whatsappConfig.instance_status !== "connected") {
      return;
    }

    // Buscar dados do pedido
    const { data: order } = await supabase
      .from("orders")
      .select("customer_name, delivery_phone")
      .eq("id", orderId)
      .single();

    if (!order?.delivery_phone) {
      return;
    }

    // Selecionar template de mensagem
    const messageTemplate = paymentStatus === "approved" 
      ? whatsappConfig.message_payment_approved 
      : whatsappConfig.message_payment_rejected;

    if (!messageTemplate) {
      return;
    }

    // Substituir variáveis
    const message = messageTemplate
      .replace(/{nome}/g, order.customer_name)
      .replace(/{pedido}/g, orderId.slice(0, 8).toUpperCase());

    // Enviar via edge function
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        phone: order.delivery_phone,
        message,
        messageType: paymentStatus === "approved" ? "payment_approved" : "payment_rejected"
      })
    });

  } catch (error) {
    console.error("Error sending WhatsApp notification:", error);
  }
}
