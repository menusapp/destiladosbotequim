import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DD_API_BASE = "https://api.deliverydireto.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, restaurant_id, store_id, username, password } = await req.json();
    console.log(`[dd-auth] action=${action}, restaurant_id=${restaurant_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const DD_CLIENT_ID = Deno.env.get("DD_CLIENT_ID");
    const DD_CLIENT_SECRET = Deno.env.get("DD_CLIENT_SECRET");

    if (!DD_CLIENT_ID || !DD_CLIENT_SECRET) {
      console.error("[dd-auth] Missing DD_CLIENT_ID or DD_CLIENT_SECRET");
      return new Response(JSON.stringify({ error: "Credenciais do Delivery Direto não configuradas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "connect") {
      if (!store_id || !username || !password) {
        return new Response(JSON.stringify({ error: "Store ID, username e password são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 1: Authenticate with DD API
      console.log("[dd-auth] Requesting token from Delivery Direto...");
      const tokenRes = await fetch(`${DD_API_BASE}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
        },
        body: JSON.stringify({ username, password, store_id }),
      });

      const tokenText = await tokenRes.text();
      console.log(`[dd-auth] Token response status=${tokenRes.status}`);

      if (!tokenRes.ok) {
        console.error(`[dd-auth] Token error: ${tokenText}`);
        return new Response(JSON.stringify({ error: `Erro na autenticação: ${tokenText}` }), {
          status: tokenRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenData = JSON.parse(tokenText);
      const accessToken = tokenData.access_token || tokenData.token;
      const expiresIn = tokenData.expires_in || 3600;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      console.log(`[dd-auth] Token obtained, expires_in=${expiresIn}`);

      // Step 2: Hash password for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Step 3: Save config
      console.log("[dd-auth] Saving config to database...");
      const { error: upsertError } = await supabase
        .from("deliverydireto_config")
        .upsert({
          restaurant_id,
          store_id,
          username,
          password_hash: passwordHash,
          client_id: DD_CLIENT_ID,
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          enabled: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "restaurant_id" });

      if (upsertError) {
        console.error("[dd-auth] DB upsert error:", upsertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar configuração" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 4: Register webhooks
      console.log("[dd-auth] Registering webhooks...");
      const webhookUrl = `${supabaseUrl}/functions/v1/dd-webhook`;
      
      try {
        for (const event of ["ORDER_PLACED", "ORDER_STATUS_CHANGED"]) {
          const whRes = await fetch(`${DD_API_BASE}/webhooks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
              "X-DeliveryDireto-Client-Id": DD_CLIENT_ID,
              "X-DeliveryDireto-Id": store_id,
            },
            body: JSON.stringify({ url: webhookUrl, event }),
          });
          const whText = await whRes.text();
          console.log(`[dd-auth] Webhook ${event}: status=${whRes.status}, body=${whText}`);
        }
      } catch (whErr) {
        console.warn("[dd-auth] Webhook registration failed (non-blocking):", whErr);
      }

      console.log("[dd-auth] Connection successful!");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await supabase
        .from("deliverydireto_config")
        .update({
          enabled: false,
          access_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restaurant_id);

      console.log("[dd-auth] Disconnected successfully");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh_token") {
      return await refreshToken(supabase, restaurant_id, DD_CLIENT_ID);
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dd-auth] Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function refreshToken(supabase: any, restaurantId: string, clientId: string) {
  console.log("[dd-auth] Refreshing token...");
  
  const { data: config } = await supabase
    .from("deliverydireto_config")
    .select("store_id, username, password_hash, access_token, token_expires_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!config?.store_id || !config?.username) {
    return new Response(JSON.stringify({ error: "Config não encontrada" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check if token is still valid (> 5 min remaining)
  if (config.token_expires_at) {
    const expiresAt = new Date(config.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (expiresAt > fiveMinFromNow) {
      console.log("[dd-auth] Token still valid, skipping refresh");
      return new Response(JSON.stringify({ success: true, access_token: config.access_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // We can't recover the plain password from hash, so we re-auth using stored credentials
  // The username/password must be re-provided or we use a refresh mechanism
  // For now, return error indicating re-auth needed
  console.warn("[dd-auth] Token expired, re-authentication needed");
  return new Response(JSON.stringify({ error: "Token expirado. Reconecte a integração.", expired: true }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
