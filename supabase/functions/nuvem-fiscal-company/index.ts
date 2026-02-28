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
    const { restaurantId } = await req.json();
    if (!restaurantId) {
      return new Response(
        JSON.stringify({ success: false, error: "restaurantId é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch fiscal config from DB
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config, error: dbError } = await supabase
      .from("fiscal_configs")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (dbError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuração fiscal não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const required = ["cnpj", "razao_social", "cep", "logradouro", "numero", "bairro", "municipio_codigo", "uf"];
    const missing = required.filter((f) => !config[f]);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Campos obrigatórios faltando: ${missing.join(", ")}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. OAuth2 - get access token
    const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
    const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Nuvem Fiscal não configuradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenRes = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "empresa cep cnpj nfce",
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error("OAuth response not JSON:", tokenText);
      return new Response(
        JSON.stringify({ success: false, error: `Resposta inválida do OAuth: ${tokenText.substring(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("OAuth error:", tokenRes.status, tokenData);
      return new Response(
        JSON.stringify({ success: false, error: `Falha na autenticação Nuvem Fiscal (${tokenRes.status}): ${tokenData.error_description || tokenData.error || "desconhecido"}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Clean CNPJ (remove formatting)
    const cpfCnpj = config.cnpj.replace(/\D/g, "");

    // 4. Create company payload
    const payload = {
      cpf_cnpj: cpfCnpj,
      inscricao_estadual: config.inscricao_estadual || "",
      nome_razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia || config.razao_social,
      email: config.email || "",
      fone: config.telefone ? config.telefone.replace(/\D/g, "") : "",
      endereco: {
        cep: config.cep ? config.cep.replace(/\D/g, "") : "",
        logradouro: config.logradouro,
        numero: config.numero,
        complemento: config.complemento || "",
        bairro: config.bairro,
        codigo_municipio: config.municipio_codigo,
        uf: config.uf,
      },
    };

    console.log("Creating company in Nuvem Fiscal:", JSON.stringify(payload));

    // 5. POST to Nuvem Fiscal API
    const companyRes = await fetch("https://api.nuvemfiscal.com.br/empresas", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const companyText = await companyRes.text();
    let companyData: any;
    try {
      companyData = JSON.parse(companyText);
    } catch {
      console.error("Company API response not JSON:", companyText);
      return new Response(
        JSON.stringify({ success: false, error: `Resposta inválida da API: ${companyText.substring(0, 300)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!companyRes.ok) {
      console.error("Nuvem Fiscal API error:", companyRes.status, companyData);
      const errorMsg = companyData?.error?.message || companyData?.message || JSON.stringify(companyData);
      return new Response(
        JSON.stringify({ success: false, error: `Erro Nuvem Fiscal (${companyRes.status}): ${errorMsg}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Company created successfully:", companyData);

    return new Response(
      JSON.stringify({ success: true, data: companyData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
