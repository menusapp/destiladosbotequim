import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
    console.log("[register-restaurant] Received body keys:", Object.keys(body));

    const { name, slug, cnpj, phone, address, username, password, planSlug } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
      console.error("[register-restaurant] Invalid name:", name);
      return new Response(JSON.stringify({ error: "Nome do restaurante inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!slug || typeof slug !== "string" || !/^[a-z0-9-]{3,50}$/.test(slug)) {
      console.error("[register-restaurant] Invalid slug:", slug);
      return new Response(JSON.stringify({ error: "Slug inválido (apenas letras minúsculas, números e hífens, 3-50 caracteres)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!username || typeof username !== "string" || username.trim().length < 3 || username.length > 100) {
      console.error("[register-restaurant] Invalid username:", username);
      return new Response(JSON.stringify({ error: "Usuário inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!password || typeof password !== "string" || password.length < 6 || password.length > 100) {
      console.error("[register-restaurant] Invalid password length");
      return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!planSlug || !["basico", "intermediario", "avancado", "trial"].includes(planSlug)) {
      console.error("[register-restaurant] Invalid planSlug:", planSlug);
      return new Response(JSON.stringify({ error: "Plano inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[register-restaurant] Validation passed. Creating Supabase client...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check slug uniqueness
    console.log("[register-restaurant] Checking slug uniqueness:", slug.trim());
    const { data: existingSlug, error: slugCheckError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (slugCheckError) {
      console.error("[register-restaurant] Slug check error:", slugCheckError);
    }

    if (existingSlug) {
      console.error("[register-restaurant] Slug already in use:", slug);
      return new Response(JSON.stringify({ error: "Este slug já está em uso. Escolha outro." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check username uniqueness
    console.log("[register-restaurant] Checking username uniqueness:", username.trim());
    const { data: existingUser, error: userCheckError } = await supabase
      .from("restaurant_credentials")
      .select("id")
      .eq("username", username.trim())
      .maybeSingle();

    if (userCheckError) {
      console.error("[register-restaurant] Username check error:", userCheckError);
    }

    if (existingUser) {
      console.error("[register-restaurant] Username already in use:", username);
      return new Response(JSON.stringify({ error: "Este nome de usuário já está em uso." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine the actual plan to use
    const isTrial = planSlug === "trial";
    const actualPlanName = isTrial ? "Básico" : {
      basico: "Básico",
      intermediario: "Intermediário",
      avancado: "Avançado",
    }[planSlug] || "Básico";

    // Find the subscription plan
    console.log("[register-restaurant] Looking for plan:", actualPlanName);
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, name")
      .eq("name", actualPlanName)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      console.error("[register-restaurant] Plan lookup error:", planError);
    }

    if (!plan) {
      console.error("[register-restaurant] Plan not found for:", actualPlanName);
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[register-restaurant] Plan found:", plan.id, plan.name);

    // Hash password
    let passwordHash: string;
    try {
      console.log("[register-restaurant] Hashing password...");
      passwordHash = hashSync(password);
      console.log("[register-restaurant] Password hashed successfully");
    } catch (hashError) {
      console.error("[register-restaurant] bcrypt hash failed:", hashError);
      return new Response(JSON.stringify({ error: "Erro ao processar senha. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate trial dates
    const now = new Date();
    const trialEndsAt = isTrial ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : null;

    // 1. Create restaurant
    console.log("[register-restaurant] Creating restaurant...");
    const restaurantInsert: any = {
      name: name.trim(),
      slug: slug.trim(),
      cnpj: cnpj?.trim() || null,
      endereco_fiscal: address?.trim() || null,
    };
    if (isTrial) {
      restaurantInsert.trial_started_at = now.toISOString();
      restaurantInsert.trial_ends_at = trialEndsAt!.toISOString();
      restaurantInsert.trial_expired = false;
    }

    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .insert(restaurantInsert)
      .select("id")
      .single();

    if (restError || !restaurant) {
      console.error("[register-restaurant] Restaurant creation failed:", restError);
      return new Response(JSON.stringify({ error: "Erro ao criar restaurante: " + (restError?.message || "desconhecido") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[register-restaurant] Restaurant created:", restaurant.id);

    // 2. Create credentials
    console.log("[register-restaurant] Creating credentials...");
    const { error: credError } = await supabase
      .from("restaurant_credentials")
      .insert({
        restaurant_id: restaurant.id,
        username: username.trim(),
        password_hash: passwordHash,
      });

    if (credError) {
      console.error("[register-restaurant] Credentials creation failed:", credError);
      await supabase.from("restaurants").delete().eq("id", restaurant.id);
      return new Response(JSON.stringify({ error: "Erro ao criar credenciais: " + credError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[register-restaurant] Credentials created successfully");

    // 3. Create staff admin account (so user can login via staff login)
    console.log("[register-restaurant] Creating staff admin account...");
    const { error: staffError } = await supabase
      .from("restaurant_staff")
      .insert({
        restaurant_id: restaurant.id,
        display_name: name.trim(),
        username: username.trim(),
        password_hash: passwordHash,
        role: "admin",
        allowed_sections: JSON.stringify([]),
        is_active: true,
      });

    if (staffError) {
      console.error("[register-restaurant] Staff creation error (non-blocking):", staffError);
    } else {
      console.log("[register-restaurant] Staff admin created");
    }

    // 4. Create subscription
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);

    console.log("[register-restaurant] Creating subscription...");
    const subInsert: any = {
      restaurant_id: restaurant.id,
      plan_id: plan.id,
      status: "active",
      started_at: now.toISOString(),
      next_payment_at: isTrial ? trialEndsAt!.toISOString() : nextPayment.toISOString(),
    };
    if (isTrial) {
      subInsert.is_trial = true;
    }

    const { error: subError } = await (supabase.from("restaurant_subscriptions" as any) as any).insert(subInsert);

    if (subError) {
      console.error("[register-restaurant] Subscription error (non-blocking):", subError);
    } else {
      console.log("[register-restaurant] Subscription created successfully");
    }

    console.log("[register-restaurant] Registration complete for slug:", slug.trim());

    return new Response(
      JSON.stringify({ success: true, restaurantId: restaurant.id, slug: slug.trim(), isTrial }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[register-restaurant] Unhandled error:", message);
    if (error instanceof Error && error.stack) {
      console.error("[register-restaurant] Stack:", error.stack);
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
