import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpAppId = Deno.env.get("MERCADOPAGO_APP_ID");
    const mpClientSecret = Deno.env.get("MERCADOPAGO_CLIENT_SECRET");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);

    // GET - Callback do OAuth (redirecionamento do Mercado Pago)
    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // restaurantId
      const error = url.searchParams.get("error");

      // URL de redirecionamento após o processo
      const adminUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/admin`;

      if (error) {
        console.error("OAuth error from MP:", error);
        return Response.redirect(`${adminUrl}?oauth=error&error=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) {
        return Response.redirect(`${adminUrl}?oauth=error&error=missing_params`, 302);
      }

      if (!mpAppId || !mpClientSecret) {
        console.error("Missing MP credentials");
        return Response.redirect(`${adminUrl}?oauth=error&error=config_error`, 302);
      }

      try {
        // Trocar code por access_token
        const tokenResponse = await fetch(MP_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: mpAppId,
            client_secret: mpClientSecret,
            code: code,
            redirect_uri: `${supabaseUrl}/functions/v1/payment-oauth`
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error) {
          console.error("Token exchange error:", tokenData);
          return Response.redirect(`${adminUrl}?oauth=error&error=token_exchange_failed`, 302);
        }

        // Salvar tokens no banco
        const { error: dbError } = await supabase
          .from("online_payment_config")
          .upsert({
            restaurant_id: state,
            provider: "mercadopago",
            mp_access_token: tokenData.access_token,
            mp_refresh_token: tokenData.refresh_token,
            mp_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            mp_user_id: tokenData.user_id?.toString(),
            mp_public_key: tokenData.public_key,
            connection_status: "connected",
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: "restaurant_id" });

        if (dbError) {
          console.error("Database error:", dbError);
          return Response.redirect(`${adminUrl}?oauth=error&error=database_error`, 302);
        }

        return Response.redirect(`${adminUrl}?oauth=success`, 302);

      } catch (err) {
        console.error("OAuth callback error:", err);
        return Response.redirect(`${adminUrl}?oauth=error&error=server_error`, 302);
      }
    }

    // POST - Ações de OAuth
    if (req.method === "POST") {
      const body = await req.json();
      const { action, restaurantId } = body;

      if (!restaurantId) {
        return new Response(
          JSON.stringify({ error: "restaurantId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "authorize") {
        // Verificar se secrets estão configurados
        if (!mpAppId) {
          return new Response(
            JSON.stringify({ error: "Secret MERCADOPAGO_APP_ID não configurado. Entre em contato com o suporte." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Criar/atualizar registro com status 'connecting' ANTES de redirecionar
        const { error: upsertError } = await supabase
          .from("online_payment_config")
          .upsert({
            restaurant_id: restaurantId,
            provider: "mercadopago",
            connection_status: "connecting",
            updated_at: new Date().toISOString()
          }, { onConflict: "restaurant_id" });

        if (upsertError) {
          console.error("Upsert error:", upsertError);
          return new Response(
            JSON.stringify({ error: "Erro ao preparar conexão com Mercado Pago" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const redirectUri = `${supabaseUrl}/functions/v1/payment-oauth`;
        const authUrl = `${MP_AUTH_URL}?client_id=${mpAppId}&response_type=code&platform_id=mp&state=${restaurantId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        return new Response(
          JSON.stringify({ authUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } else if (action === "disconnect") {
        // Remover conexão
        const { error } = await supabase
          .from("online_payment_config")
          .update({
            mp_access_token: null,
            mp_refresh_token: null,
            mp_token_expires_at: null,
            mp_user_id: null,
            mp_public_key: null,
            connection_status: "disconnected",
            connected_at: null,
            enabled: false,
            updated_at: new Date().toISOString()
          })
          .eq("restaurant_id", restaurantId);

        if (error) {
          console.error("Disconnect error:", error);
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } else if (action === "refresh") {
        // Renovar token (caso expire)
        const { data: config } = await supabase
          .from("online_payment_config")
          .select("mp_refresh_token")
          .eq("restaurant_id", restaurantId)
          .single();

        if (!config?.mp_refresh_token || !mpAppId || !mpClientSecret) {
          return new Response(
            JSON.stringify({ error: "Não é possível renovar token" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tokenResponse = await fetch(MP_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: mpAppId,
            client_secret: mpClientSecret,
            refresh_token: config.mp_refresh_token
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error) {
          // Token inválido, desconectar
          await supabase
            .from("online_payment_config")
            .update({ connection_status: "disconnected" })
            .eq("restaurant_id", restaurantId);

          return new Response(
            JSON.stringify({ error: "Token expirado, reconecte sua conta" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Atualizar tokens
        await supabase
          .from("online_payment_config")
          .update({
            mp_access_token: tokenData.access_token,
            mp_refresh_token: tokenData.refresh_token,
            mp_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("restaurant_id", restaurantId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } else {
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("payment-oauth error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
