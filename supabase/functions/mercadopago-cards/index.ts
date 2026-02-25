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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, restaurant_id, customer_cpf, card_record_id } = await req.json();

    if (!restaurant_id) {
      return new Response(
        JSON.stringify({ error: "restaurant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── LIST CARDS ───
    if (action === "list") {
      if (!customer_cpf) {
        return new Response(
          JSON.stringify({ cards: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: cards, error } = await supabase
        .from("customer_cards")
        .select("id, last_four_digits, payment_method_id, first_six_digits, expiration_month, expiration_year, card_id, mp_customer_id")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_cpf", customer_cpf.replace(/\D/g, ""))
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[MP Cards] List error:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar cartões" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ cards: cards || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DELETE CARD ───
    if (action === "delete") {
      if (!card_record_id) {
        return new Response(
          JSON.stringify({ error: "card_record_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch the card record
      const { data: cardRecord, error: fetchError } = await supabase
        .from("customer_cards")
        .select("*")
        .eq("id", card_record_id)
        .eq("restaurant_id", restaurant_id)
        .maybeSingle();

      if (fetchError || !cardRecord) {
        return new Response(
          JSON.stringify({ error: "Cartão não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch restaurant's MP access token
      const { data: config } = await supabase
        .from("online_payment_config")
        .select("mp_access_token")
        .eq("restaurant_id", restaurant_id)
        .maybeSingle();

      if (config?.mp_access_token) {
        // Try to delete from MP API (best effort)
        try {
          await fetch(
            `https://api.mercadopago.com/v1/customers/${cardRecord.mp_customer_id}/cards/${cardRecord.card_id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${config.mp_access_token}` },
            }
          );
        } catch (e) {
          console.warn("[MP Cards] Failed to delete from MP API:", e);
        }
      }

      // Delete from our DB
      const { error: deleteError } = await supabase
        .from("customer_cards")
        .delete()
        .eq("id", card_record_id);

      if (deleteError) {
        console.error("[MP Cards] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Erro ao excluir cartão" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "action inválida. Use 'list' ou 'delete'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[MP Cards] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
