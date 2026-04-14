import { compareSync, hashSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, current_password, new_username, new_name, new_password } = await req.json();

    if (!restaurant_id || !current_password) {
      return new Response(
        JSON.stringify({ success: false, error: "restaurant_id e senha atual são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch current credentials
    const { data: creds, error: fetchError } = await supabase
      .from("restaurant_credentials")
      .select("id, password_hash, username")
      .eq("restaurant_id", restaurant_id)
      .limit(1)
      .single();

    if (fetchError || !creds) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais não encontradas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify current password
    const isBcrypt = creds.password_hash.startsWith("$2a$") || creds.password_hash.startsWith("$2b$") || creds.password_hash.startsWith("$2y$");
    let valid = false;
    if (isBcrypt) {
      valid = compareSync(current_password, creds.password_hash);
    } else {
      valid = current_password === creds.password_hash;
    }

    if (!valid) {
      return new Response(
        JSON.stringify({ success: false, error: "Senha atual incorreta" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update credentials
    const credUpdate: Record<string, string> = {};
    if (new_username && new_username !== creds.username) {
      // Check if username already exists
      const { data: existing } = await supabase
        .from("restaurant_credentials")
        .select("id")
        .eq("username", new_username)
        .neq("restaurant_id", restaurant_id)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Este nome de usuário já está em uso" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      credUpdate.username = new_username;
    }

    if (new_password) {
      credUpdate.password_hash = hashSync(new_password);
    }

    if (Object.keys(credUpdate).length > 0) {
      const { error: updateCredError } = await supabase
        .from("restaurant_credentials")
        .update(credUpdate)
        .eq("restaurant_id", restaurant_id);
      if (updateCredError) throw updateCredError;
    }

    // Update restaurant name
    if (new_name) {
      const { error: updateNameError } = await supabase
        .from("restaurants")
        .update({ name: new_name })
        .eq("id", restaurant_id);
      if (updateNameError) throw updateNameError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
