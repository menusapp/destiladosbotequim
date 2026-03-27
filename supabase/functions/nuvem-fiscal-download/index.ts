const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getNuvemFiscalToken(): Promise<string> {
  const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
  const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais Nuvem Fiscal não configuradas");

  const tokenRes = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "empresa cep cnpj nfce",
      audience: "https://api.nuvemfiscal.com.br/",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`OAuth falhou: ${tokenData.error_description || tokenData.error || "desconhecido"}`);
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nuvem_fiscal_ref, type } = await req.json();

    if (!nuvem_fiscal_ref || !type) {
      return new Response(JSON.stringify({ error: "nuvem_fiscal_ref e type (pdf|xml) são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type !== "pdf" && type !== "xml") {
      return new Response(JSON.stringify({ error: "type deve ser 'pdf' ou 'xml'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getNuvemFiscalToken();

    // GET /nfce/{id}/pdf or /nfce/{id}/xml
    const downloadRes = await fetch(`https://api.nuvemfiscal.com.br/nfce/${nuvem_fiscal_ref}/${type}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadRes.ok) {
      const errBody = await downloadRes.text();
      return new Response(JSON.stringify({ error: `Erro ao baixar ${type}: ${errBody.substring(0, 300)}` }), {
        status: downloadRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = type === "pdf" ? "application/pdf" : "application/xml";
    const fileData = await downloadRes.arrayBuffer();

    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="nfce_${nuvem_fiscal_ref}.${type}"`,
      },
    });
  } catch (error: any) {
    console.error("[NuvemFiscal-Download] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
