import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IFOOD_API = "https://merchant-api.ifood.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get("IFOOD_CLIENT_ID");
    const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "iFood credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { restaurant_id } = await req.json();

    const { data: config } = await supabase
      .from("ifood_config")
      .select("refresh_token")
      .eq("restaurant_id", restaurant_id)
      .single();

    if (!config?.refresh_token) {
      return new Response(
        JSON.stringify({ error: "No refresh token. Restaurant needs to reconnect." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(`${IFOOD_API}/authentication/v1.0/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "refresh_token",
        clientId,
        clientSecret,
        refreshToken: config.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("iFood refresh failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Refresh failed. Restaurant needs to reconnect.", details: errorText }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + tokenData.expiresIn * 1000).toISOString();

    await supabase
      .from("ifood_config")
      .update({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("restaurant_id", restaurant_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ifood-refresh-token error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
