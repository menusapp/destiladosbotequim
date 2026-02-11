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

    const subAccountApiKey = config.asaas_api_key;

    // 1. Fetch account status using sub-account API key (myAccount/status)
    let accountStatusData: Record<string, string> = {};
    if (subAccountApiKey) {
      try {
        const myStatusRes = await fetch(`${baseUrl}/myAccount/status`, {
          headers: { access_token: subAccountApiKey },
        });
        if (myStatusRes.ok) {
          accountStatusData = await myStatusRes.json();
          console.log("[asaas-status] myAccount/status:", JSON.stringify(accountStatusData));
        } else {
          console.error("[asaas-status] myAccount/status error:", await myStatusRes.text());
        }
      } catch (e) {
        console.error("[asaas-status] myAccount/status fetch error:", e);
      }
    }

    // 2. Fetch pending documents using sub-account API key (myAccount/documents)
    let documentsData: any[] = [];
    if (subAccountApiKey) {
      try {
        const docsRes = await fetch(`${baseUrl}/myAccount/documents`, {
          headers: { access_token: subAccountApiKey },
        });
        if (docsRes.ok) {
          const docsResponse = await docsRes.json();
          documentsData = docsResponse.data || [];
          console.log("[asaas-status] myAccount/documents:", JSON.stringify(documentsData.length), "documents");
        } else {
          console.error("[asaas-status] myAccount/documents error:", await docsRes.text());
        }
      } catch (e) {
        console.error("[asaas-status] myAccount/documents fetch error:", e);
      }
    }

    // 3. Determine status from myAccount/status response
    const generalStatus = accountStatusData.general || "PENDING";
    const commercialInfoStatus = accountStatusData.commercialInfo || "PENDING";
    const documentationStatus = accountStatusData.documentation || "PENDING";

    let dbAccountStatus: string;
    if (generalStatus === "APPROVED") {
      dbAccountStatus = "approved";
    } else if (generalStatus === "REJECTED") {
      dbAccountStatus = "rejected";
    } else {
      dbAccountStatus = "pending";
    }

    const connectionStatus = subAccountApiKey && dbAccountStatus === "approved"
      ? "connected"
      : "pending";

    // 4. Map documents for frontend
    const mappedDocuments = documentsData.map((doc: any) => ({
      id: doc.id,
      status: doc.status,
      type: doc.type,
      title: doc.title || doc.type,
      description: doc.description || null,
      responsible: doc.responsible || null,
      onboardingUrl: doc.onboardingUrl || null,
    }));

    // 5. Update config in database
    const { error: updateError } = await supabase
      .from("online_payment_config")
      .update({
        asaas_account_status: dbAccountStatus,
        connection_status: connectionStatus,
        asaas_documents_data: mappedDocuments.length > 0 ? mappedDocuments : null,
      })
      .eq("restaurant_id", restaurant_id);

    if (updateError) {
      console.error("[asaas-status] Error updating config:", updateError);
    }

    return new Response(
      JSON.stringify({
        account_status: dbAccountStatus,
        connection_status: connectionStatus,
        detailed_status: {
          general: generalStatus,
          commercialInfo: commercialInfoStatus,
          documentation: documentationStatus,
        },
        documents: mappedDocuments,
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
