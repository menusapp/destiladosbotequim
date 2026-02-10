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
    const asaasMasterKey = Deno.env.get("ASAAS_API_KEY")!;
    const asaasEnv = Deno.env.get("ASAAS_ENVIRONMENT") || "sandbox";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const baseUrl =
      asaasEnv === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

    const body = await req.json();
    const { restaurant_id } = body;

    if (!restaurant_id) {
      return new Response(
        JSON.stringify({ error: "restaurant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get config
    const { data: config, error: configError } = await supabase
      .from("online_payment_config")
      .select("asaas_account_id, asaas_api_key")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (configError || !config?.asaas_account_id) {
      return new Response(
        JSON.stringify({ error: "Conta Asaas não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check account status using master key
    const statusRes = await fetch(`${baseUrl}/accounts/${config.asaas_account_id}`, {
      headers: { access_token: asaasMasterKey },
    });

    if (!statusRes.ok) {
      console.error("[asaas-status] Error fetching status:", await statusRes.text());
      return new Response(
        JSON.stringify({ error: "Erro ao consultar status da conta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountData = await statusRes.json();

    // Determine connection status
    const hasApiKey = !!config.asaas_api_key;
    const accountStatus = accountData.commercialInfoExpiration?.isExpired === false
      ? "active"
      : accountData.loginEmail
        ? "pending_documents"
        : "pending";

    const connectionStatus = hasApiKey ? "connected" : "pending";

    // Update config in database
    const { error: updateError } = await supabase
      .from("online_payment_config")
      .update({
        asaas_account_status: accountStatus,
        connection_status: connectionStatus,
      })
      .eq("restaurant_id", restaurant_id);

    if (updateError) {
      console.error("[asaas-status] Error updating config:", updateError);
    }

    return new Response(
      JSON.stringify({
        account_status: accountStatus,
        connection_status: connectionStatus,
        account_data: {
          name: accountData.name,
          email: accountData.email,
          cpfCnpj: accountData.cpfCnpj,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[asaas-status] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
