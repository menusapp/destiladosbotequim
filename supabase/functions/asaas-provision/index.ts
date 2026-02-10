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

    // Debug: log environment and key prefix
    console.log("[asaas-provision] Environment:", asaasEnv);
    console.log("[asaas-provision] API Key prefix:", asaasMasterKey?.substring(0, 15) + "...");
    console.log("[asaas-provision] API Key length:", asaasMasterKey?.length);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const baseUrl =
      asaasEnv === "production"
        ? "https://api.asaas.com/api/v3"
        : "https://sandbox.asaas.com/api/v3";
    
    console.log("[asaas-provision] Using base URL:", baseUrl);

    const body = await req.json();
    const {
      restaurant_id,
      name,
      cpf_cnpj,
      email,
      phone,
      mobile_phone,
      address,
      address_number,
      complement,
      province,
      postal_code,
      city,
      state,
      company_type,
      income_value,
      birth_date,
    } = body;

    if (!restaurant_id || !name || !cpf_cnpj || !email) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: restaurant_id, name, cpf_cnpj, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if restaurant already has an Asaas account
    const { data: existingConfig } = await supabase
      .from("online_payment_config")
      .select("asaas_account_id")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (existingConfig?.asaas_account_id) {
      return new Response(
        JSON.stringify({ error: "Este restaurante já possui uma conta Asaas configurada" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sub-account on Asaas
    const accountPayload: Record<string, unknown> = {
      name,
      cpfCnpj: cpf_cnpj.replace(/\D/g, ""),
      email,
      mobilePhone: (mobile_phone || phone || "").replace(/\D/g, ""),
      address,
      addressNumber: address_number,
      complement: complement || undefined,
      province,
      postalCode: (postal_code || "").replace(/\D/g, ""),
      city,
      state,
      companyType: company_type || undefined,
      incomeValue: income_value || undefined,
      birthDate: birth_date || undefined,
    };

    // Remove undefined values
    Object.keys(accountPayload).forEach((key) => {
      if (accountPayload[key] === undefined) delete accountPayload[key];
    });

    console.log("[asaas-provision] Creating sub-account:", JSON.stringify(accountPayload));

    const asaasResponse = await fetch(`${baseUrl}/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasMasterKey,
      },
      body: JSON.stringify(accountPayload),
    });

    // Safely read response - check content type before parsing as JSON
    const responseText = await asaasResponse.text();
    const contentType = asaasResponse.headers.get("content-type") || "";
    
    console.log("[asaas-provision] Response status:", asaasResponse.status);
    console.log("[asaas-provision] Response content-type:", contentType);
    console.log("[asaas-provision] Response preview:", responseText.substring(0, 300));

    let asaasData: any;
    if (contentType.includes("application/json") || (responseText.trim().startsWith("{") || responseText.trim().startsWith("["))) {
      try {
        asaasData = JSON.parse(responseText);
      } catch {
        console.error("[asaas-provision] Failed to parse JSON:", responseText.substring(0, 500));
        return new Response(
          JSON.stringify({ error: "Resposta inválida da API do Asaas", details: responseText.substring(0, 300) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.error("[asaas-provision] Asaas returned non-JSON:", responseText.substring(0, 500));
      return new Response(
        JSON.stringify({ 
          error: "A API do Asaas retornou uma resposta inesperada. Verifique se a chave API está correta e é de produção.", 
          details: `Status: ${asaasResponse.status}, Content-Type: ${contentType}` 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!asaasResponse.ok) {
      console.error("[asaas-provision] Asaas error:", JSON.stringify(asaasData));
      const errorMsg =
        asaasData.errors?.map((e: any) => e.description).join(", ") ||
        "Erro ao criar conta no Asaas";
      return new Response(
        JSON.stringify({ error: errorMsg, details: asaasData }),
        { status: asaasResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[asaas-provision] Sub-account created:", JSON.stringify(asaasData));

    // Save to database
    const configData = {
      restaurant_id,
      provider: "asaas",
      asaas_api_key: asaasData.apiKey || null,
      asaas_wallet_id: asaasData.walletId || null,
      asaas_account_id: asaasData.id || null,
      asaas_onboarding_url: asaasData.accountNumber?.onboardingUrl || null,
      asaas_account_status: asaasData.accountNumber?.status || "pending",
      connection_status: asaasData.apiKey ? "connected" : "pending",
      connected_at: asaasData.apiKey ? new Date().toISOString() : null,
      enabled: false,
    };

    // Upsert: update if exists, insert if not
    const { data: upsertedConfig, error: upsertError } = await supabase
      .from("online_payment_config")
      .upsert(configData, { onConflict: "restaurant_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[asaas-provision] DB upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Conta criada no Asaas mas erro ao salvar no banco", details: upsertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_id: asaasData.id,
        api_key: asaasData.apiKey,
        wallet_id: asaasData.walletId,
        onboarding_url: asaasData.accountNumber?.onboardingUrl || null,
        config: upsertedConfig,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[asaas-provision] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
