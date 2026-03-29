import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
    const body = await req.json();

    const { name, slug, cnpj, phone, address, username, password, planSlug } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
      return new Response(JSON.stringify({ error: "Nome do restaurante inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!slug || typeof slug !== "string" || !/^[a-z0-9-]{3,50}$/.test(slug)) {
      return new Response(JSON.stringify({ error: "Slug inválido (apenas letras minúsculas, números e hífens, 3-50 caracteres)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!username || typeof username !== "string" || username.trim().length < 3 || username.length > 100) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!password || typeof password !== "string" || password.length < 6 || password.length > 100) {
      return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!planSlug || !["basico", "intermediario", "avancado"].includes(planSlug)) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check slug uniqueness
    const { data: existingSlug } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (existingSlug) {
      return new Response(JSON.stringify({ error: "Este slug já está em uso. Escolha outro." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check username uniqueness
    const { data: existingUser } = await supabase
      .from("restaurant_credentials")
      .select("id")
      .eq("username", username.trim())
      .maybeSingle();

    if (existingUser) {
      return new Response(JSON.stringify({ error: "Este nome de usuário já está em uso." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map planSlug to plan name
    const planNameMap: Record<string, string> = {
      basico: "Básico",
      intermediario: "Intermediário",
      avancado: "Avançado",
    };

    // Find the subscription plan
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, name")
      .eq("name", planNameMap[planSlug])
      .eq("is_active", true)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Hash password
    const passwordHash = await hash(password);

    // 1. Create restaurant
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        cnpj: cnpj?.trim() || null,
        endereco_fiscal: address?.trim() || null,
      })
      .select("id")
      .single();

    if (restError || !restaurant) {
      return new Response(JSON.stringify({ error: "Erro ao criar restaurante: " + (restError?.message || "desconhecido") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Create credentials
    const { error: credError } = await supabase
      .from("restaurant_credentials")
      .insert({
        restaurant_id: restaurant.id,
        username: username.trim(),
        password_hash: passwordHash,
      });

    if (credError) {
      // Rollback restaurant
      await supabase.from("restaurants").delete().eq("id", restaurant.id);
      return new Response(JSON.stringify({ error: "Erro ao criar credenciais: " + credError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Create subscription
    const now = new Date().toISOString();
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);

    const { error: subError } = await (supabase.from("restaurant_subscriptions" as any) as any).insert({
      restaurant_id: restaurant.id,
      plan_id: plan.id,
      status: "active",
      started_at: now,
      next_payment_at: nextPayment.toISOString(),
    });

    if (subError) {
      console.error("Subscription error:", subError);
      // Non-blocking — restaurant and credentials already exist
    }

    return new Response(
      JSON.stringify({ success: true, restaurantId: restaurant.id, slug: slug.trim() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
