/**
 * Devolve o certificado público do QZ Tray (PEM).
 *
 * Pública (sem JWT). É seguro expor o certificado público — ele só
 * comprova a identidade. A chave privada nunca sai da edge function `qz-sign`.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cert = Deno.env.get("QZ_CERTIFICATE");
  if (!cert) {
    return new Response(
      JSON.stringify({ error: "QZ_CERTIFICATE not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(cert, {
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });
});
