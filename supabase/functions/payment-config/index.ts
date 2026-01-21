import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);

    if (req.method === "GET") {
      // GET - Retorna configuração do restaurante
      const restaurantId = url.searchParams.get("restaurantId");
      const getPublicKey = url.searchParams.get("getPublicKey");
      
      if (!restaurantId) {
        return new Response(
          JSON.stringify({ error: "restaurantId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar configuração
      const { data, error } = await supabase
        .from("online_payment_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching config:", error);
        throw error;
      }

      // Se não existe, retornar configuração padrão
      if (!data) {
        return new Response(
          JSON.stringify({
            enabled: false,
            connectionStatus: "disconnected",
            requirePrepayment: false,
            acceptPix: true,
            acceptCard: true,
            enableForDelivery: true
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se solicitou public key para o SDK do frontend
      if (getPublicKey === "true") {
        const publicKey = Deno.env.get("MERCADOPAGO_PUBLIC_KEY");
        return new Response(
          JSON.stringify({
            publicKey: publicKey || null,
            enabled: data.enabled,
            connectionStatus: data.connection_status,
            acceptPix: data.accept_pix,
            acceptCard: data.accept_card,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Retornar apenas dados públicos (sem tokens)
      return new Response(
        JSON.stringify({
          enabled: data.enabled,
          connectionStatus: data.connection_status,
          connectedAt: data.connected_at,
          requirePrepayment: data.require_prepayment,
          acceptPix: data.accept_pix,
          acceptCard: data.accept_card,
          enableForDelivery: data.enable_for_delivery,
          mpUserId: data.mp_user_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (req.method === "PUT") {
      // PUT - Atualiza configuração
      const body = await req.json();
      const { restaurantId, enabled, requirePrepayment, acceptPix, acceptCard, enableForDelivery } = body;

      if (!restaurantId) {
        return new Response(
          JSON.stringify({ error: "restaurantId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert configuração
      const { error } = await supabase
        .from("online_payment_config")
        .upsert({
          restaurant_id: restaurantId,
          enabled: enabled ?? false,
          require_prepayment: requirePrepayment ?? false,
          accept_pix: acceptPix ?? true,
          accept_card: acceptCard ?? true,
          enable_for_delivery: enableForDelivery ?? true,
          updated_at: new Date().toISOString()
        }, { onConflict: "restaurant_id" });

      if (error) {
        console.error("Error updating config:", error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("payment-config error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
