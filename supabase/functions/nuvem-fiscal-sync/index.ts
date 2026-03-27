import { createClient } from "npm:@supabase/supabase-js@2";

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

function mapNuvemFiscalStatus(apiResult: any): { dbStatus: string; errorMessage?: string } {
  if (apiResult.error) {
    const messages: string[] = [];
    if (apiResult.error.message) messages.push(apiResult.error.message);
    if (Array.isArray(apiResult.error.errors)) {
      for (const e of apiResult.error.errors) {
        if (e.message) messages.push(e.message);
      }
    }
    return { dbStatus: "error", errorMessage: messages.join(" | ") || "Erro de validação" };
  }

  const authStatus = (apiResult.autorizacao?.status || "").toLowerCase().trim();
  const raw = (apiResult.status || "").toLowerCase().trim();
  const effectiveStatus = authStatus || raw;

  if (["autorizada", "autorizado"].includes(effectiveStatus)) return { dbStatus: "authorized" };
  if (["rejeitada", "rejeitado", "denegada", "denegado"].includes(effectiveStatus)) {
    const motivo = apiResult.autorizacao?.motivo_status || apiResult.motivo_status || "Nota rejeitada pela SEFAZ";
    return { dbStatus: "error", errorMessage: motivo };
  }
  if (["cancelada", "cancelado"].includes(effectiveStatus)) {
    return { dbStatus: "canceled", errorMessage: apiResult.motivo_status };
  }
  if (apiResult.autorizacao?.protocolo && authStatus) return { dbStatus: "authorized" };

  return { dbStatus: "processing" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { restaurant_id } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all processing notes with nuvem_fiscal_ref
    const { data: pendingNotes, error: fetchErr } = await supabase
      .from("order_fiscal_notes")
      .select("id, nuvem_fiscal_ref, status")
      .eq("restaurant_id", restaurant_id)
      .in("status", ["processing", "pending"])
      .not("nuvem_fiscal_ref", "is", null);

    if (fetchErr || !pendingNotes || pendingNotes.length === 0) {
      return new Response(JSON.stringify({ synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getNuvemFiscalToken();
    let synced = 0;

    for (const note of pendingNotes) {
      const nuvemId = note.nuvem_fiscal_ref;
      try {
        // 1. Trigger sync
        const syncRes = await fetch(`https://api.nuvemfiscal.com.br/nfce/${nuvemId}/sincronizar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        await syncRes.text(); // consume body

        // Small delay for SEFAZ processing
        await new Promise(r => setTimeout(r, 1000));

        // 2. Check current status
        const checkRes = await fetch(`https://api.nuvemfiscal.com.br/nfce/${nuvemId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!checkRes.ok) {
          await checkRes.text();
          continue;
        }

        const result = await checkRes.json();
        const { dbStatus, errorMessage } = mapNuvemFiscalStatus(result);

        const updateData: Record<string, any> = { status: dbStatus };
        if (result.numero) updateData.nfe_number = String(result.numero);
        if (result.chave) updateData.nfe_key = result.chave;
        if (errorMessage) updateData.error_message = errorMessage;

        if (dbStatus === "authorized" && nuvemId) {
          updateData.pdf_url = `https://api.nuvemfiscal.com.br/nfce/${nuvemId}/pdf`;
          updateData.xml_url = `https://api.nuvemfiscal.com.br/nfce/${nuvemId}/xml`;
        }
        if (result.autorizacao?.xml_url) updateData.xml_url = result.autorizacao.xml_url;
        if (result.autorizacao?.pdf_url) updateData.pdf_url = result.autorizacao.pdf_url;

        await supabase.from("order_fiscal_notes").update(updateData).eq("id", note.id);
        synced++;
        console.log(`[nuvem-fiscal-sync] Note ${note.id} -> ${dbStatus}`);
      } catch (e) {
        console.error(`[nuvem-fiscal-sync] Error syncing note ${note.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ synced, total: pendingNotes.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[nuvem-fiscal-sync] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
